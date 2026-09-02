package in.iare.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import in.iare.agent.dto.SamvidhaSyncRequest;
import in.iare.agent.dto.StudentDashboardResponse;
import in.iare.agent.model.*;
import in.iare.agent.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service to connect with IARE Samvidha portal (https://samvidha.iare.ac.in),
 * authenticate student credentials, scrape live academic data (name, DOB, photo, attendance, timetable, marks,
 * lab submissions, and campus notices/events), and compute authentic student monitoring telemetry.
 * Strictly free of any mock/hardcoded student data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SamvidhaService {

    private final StudentProfileRepository profileRepository;
    private final StudentAttendanceRepository attendanceRepository;
    private final StudentTimetableRepository timetableRepository;
    private final StudentMarksRepository marksRepository;
    private final StudentLabSubmissionRepository labSubmissionRepository;
    private final SamvidhaNoticeRepository noticeRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final WebClient.Builder webClientBuilder;

    @Value("${app.ai-service.url:http://localhost:8001}")
    private String aiServiceUrl;

    @Value("${app.ai-service.shared-secret:CHANGE-ME-INTERNAL-SECRET}")
    private String sharedSecret;

    private static final String SAMVIDHA_BASE_URL = "https://samvidha.iare.ac.in";
    private static final String SAMVIDHA_LOGIN_ENDPOINT = "https://samvidha.iare.ac.in/pages/login/checkUser.php";
    private static final Pattern CSRF_META_PATTERN = Pattern.compile("name=[\"']csrf-token[\"']\\s+content=[\"']([^\"']+)[\"']");
    private static final Pattern CSRF_INPUT_PATTERN = Pattern.compile("name=[\"']csrf_token[\"'][^>]*value=[\"']([^\"']+)[\"']");
    private static final Pattern PHOTO_PATTERN = Pattern.compile("<img[^>]+src=[\"']([^\"']*(?:uploads|STUDENTS|student_photos|avatar)[^\"']*)[\"']", Pattern.CASE_INSENSITIVE);

    /**
     * Authenticates student with Samvidha and syncs all live academic data.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public StudentDashboardResponse syncStudentData(SamvidhaSyncRequest request, User currentUser) {
        String cleanRoll = request.getRollNo().trim().toUpperCase();
        log.info("Initiating authentic Samvidha live sync for: {}", cleanRoll);

        // --- PRIMARY: Call the ai-service Python scraper which does real Samvidha login+parsing ---
        Map<String, Object> scraperResult = callAiServiceScraper(cleanRoll, request.getPassword());
        boolean scraperSuccess = Boolean.TRUE.equals(scraperResult.get("success"));

        if (!scraperSuccess) {
            String errorMsg = scraperResult.getOrDefault("error", "Could not connect to Samvidha").toString();
            if (errorMsg.toLowerCase().contains("invalid") || errorMsg.toLowerCase().contains("credentials") || errorMsg.toLowerCase().contains("password")) {
                throw new BadCredentialsException("Invalid Samvidha credentials for Roll Number " + cleanRoll + ". Please check your password.");
            }
            log.warn("ai-service scraper returned error for {}: {} — trying direct session handshake", cleanRoll, errorMsg);
        }

        // Refresh Samvidha notices / events from portal in background
        refreshSamvidhaNotices();

        // Locate or create StudentProfile
        StudentProfile profile = profileRepository.findByRollNo(cleanRoll)
                .orElseGet(() -> StudentProfile.builder()
                        .rollNo(cleanRoll)
                        .consentGiven(request.getConsent() != null ? request.getConsent() : true)
                        .build());

        if (currentUser != null) {
            profile.setUser(currentUser);
        }

        if (scraperSuccess) {
            // Apply REAL data from the ai-service scraper
            applyRealScrapedData(profile, scraperResult, cleanRoll);
        } else {
            // Direct Java-based live extraction attempt
            LiveSamvidhaResult liveResult = performLiveSamvidhaExtraction(cleanRoll, request.getPassword());
            if (liveResult.authenticated && liveResult.parsedSuccessfully) {
                if (liveResult.fullName != null && !liveResult.fullName.isBlank()) {
                    profile.setFullName(liveResult.fullName);
                }
                if (liveResult.photoUrl != null && !liveResult.photoUrl.isBlank()) {
                    profile.setProfilePhotoUrl(liveResult.photoUrl);
                }
            } else {
                throw new BadCredentialsException("Could not authenticate with Samvidha. Please ensure your Roll Number and Password are correct.");
            }
        }

        profile.setLastSyncedAt(Instant.now());

        // Compute Overall Attendance % from actual records
        double totalAttended = 0;
        double totalClasses = 0;
        for (StudentAttendance att : profile.getAttendanceRecords()) {
            totalAttended += att.getAttendedClasses();
            totalClasses += att.getTotalClasses();
        }
        if (totalClasses > 0) {
            double overallPct = (totalAttended / totalClasses) * 100.0;
            profile.setOverallAttendance(Math.round(overallPct * 100.0) / 100.0);
        }
        profile = profileRepository.save(profile);

        // Update User full name if user entity exists
        if (currentUser != null && profile.getFullName() != null) {
            currentUser.setFullName(profile.getFullName());
            userRepository.save(currentUser);
        }

        // Audit log
        if (currentUser != null && currentUser.getId() != null) {
            auditLogService.log(currentUser.getId(), AuditLog.EventType.SAMVIDHA_SYNC,
                    "{\"rollNo\":\"" + cleanRoll + "\",\"live\":" + scraperSuccess + "}");
        }

        return getStudentDashboard(cleanRoll);
    }

    /**
     * Get the student dashboard telemetry.
     */
    @Transactional(readOnly = true)
    public StudentDashboardResponse getStudentDashboard(String rollNo) {
        String cleanRoll = rollNo.trim().toUpperCase();
        StudentProfile profile = profileRepository.findByRollNo(cleanRoll)
                .orElseThrow(() -> new IllegalArgumentException("Student profile not found for roll: " + cleanRoll));

        List<StudentAttendance> attendanceList = attendanceRepository.findByStudentProfile(profile);
        List<StudentTimetable> fullSchedule = timetableRepository.findByStudentProfileOrderByDayOfWeekAscTimeSlotStartAsc(profile);
        List<StudentMarks> marksList = marksRepository.findByStudentProfile(profile);
        List<StudentLabSubmission> labList = labSubmissionRepository.findByStudentProfileOrderByDueDateAsc(profile);
        List<SamvidhaNotice> noticesList = noticeRepository.findAllByOrderByCreatedAtDesc();

        int dayOfWeekInt = LocalDate.now().getDayOfWeek().getValue() - 1; // 0=Mon ... 5=Sat
        if (dayOfWeekInt > 5) {
            dayOfWeekInt = 0;
        }

        int finalDay = dayOfWeekInt;
        List<StudentTimetable> todayScheduleEntities = fullSchedule.stream()
                .filter(t -> t.getDayOfWeek().equals(finalDay))
                .toList();

        double overall = profile.getOverallAttendance() != null ? profile.getOverallAttendance() : 0.0;
        String status = overall >= 75.0 ? "GOOD" : (overall >= 65.0 ? "WARNING" : "CRITICAL");

        int totalAttended = attendanceList.stream().mapToInt(StudentAttendance::getAttendedClasses).sum();
        int totalClasses = attendanceList.stream().mapToInt(StudentAttendance::getTotalClasses).sum();

        int safeBunks = totalClasses > 0 ? Math.max(0, (int) Math.floor((totalAttended - (0.75 * totalClasses)) / 0.75)) : 0;
        int classesNeeded = totalClasses > 0 && overall < 75.0 ? Math.max(0, (int) Math.ceil((0.75 * totalClasses - totalAttended) / 0.25)) : 0;

        LocalTime now = LocalTime.now();
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm");

        List<StudentDashboardResponse.TimetableDTO> todayDtos = new ArrayList<>();
        boolean nextFound = false;

        for (StudentTimetable t : todayScheduleEntities) {
            boolean isCurrent = false;
            boolean isNext = false;
            try {
                LocalTime start = LocalTime.parse(t.getTimeSlotStart(), timeFmt);
                LocalTime end = LocalTime.parse(t.getTimeSlotEnd(), timeFmt);
                if (!now.isBefore(start) && now.isBefore(end)) {
                    isCurrent = true;
                } else if (now.isBefore(start) && !nextFound) {
                    isNext = true;
                    nextFound = true;
                }
            } catch (Exception ignored) {
            }

            todayDtos.add(StudentDashboardResponse.TimetableDTO.builder()
                    .dayOfWeek(t.getDayOfWeek())
                    .timeSlotStart(t.getTimeSlotStart())
                    .timeSlotEnd(t.getTimeSlotEnd())
                    .subjectCode(t.getSubjectCode())
                    .subjectName(t.getSubjectName())
                    .room(t.getRoom())
                    .facultyName(t.getFacultyName())
                    .isCurrent(isCurrent)
                    .isNext(isNext)
                    .build());
        }

        List<StudentDashboardResponse.AttendanceDTO> attDtos = attendanceList.stream()
                .map(a -> StudentDashboardResponse.AttendanceDTO.builder()
                        .subjectCode(a.getSubjectCode())
                        .subjectName(a.getSubjectName())
                        .attendedClasses(a.getAttendedClasses())
                        .totalClasses(a.getTotalClasses())
                        .percentage(a.getPercentage())
                        .status(a.getPercentage() >= 75.0 ? "GOOD" : (a.getPercentage() >= 65.0 ? "WARNING" : "CRITICAL"))
                        .build())
                .toList();

        List<StudentDashboardResponse.TimetableDTO> weeklyDtos = fullSchedule.stream()
                .map(t -> StudentDashboardResponse.TimetableDTO.builder()
                        .dayOfWeek(t.getDayOfWeek())
                        .timeSlotStart(t.getTimeSlotStart())
                        .timeSlotEnd(t.getTimeSlotEnd())
                        .subjectCode(t.getSubjectCode())
                        .subjectName(t.getSubjectName())
                        .room(t.getRoom())
                        .facultyName(t.getFacultyName())
                        .build())
                .toList();

        List<StudentDashboardResponse.MarksDTO> marksDtos = marksList.stream()
                .map(m -> StudentDashboardResponse.MarksDTO.builder()
                        .subjectCode(m.getSubjectCode())
                        .subjectName(m.getSubjectName())
                        .cie1(m.getCie1())
                        .cie2(m.getCie2())
                        .internalTotal(m.getInternalTotal())
                        .build())
                .toList();

        List<StudentDashboardResponse.LabSubmissionDTO> labDtos = labList.stream()
                .map(l -> StudentDashboardResponse.LabSubmissionDTO.builder()
                        .subjectCode(l.getSubjectCode())
                        .subjectName(l.getSubjectName())
                        .experimentName(l.getExperimentName())
                        .dueDate(l.getDueDate())
                        .status(l.getStatus())
                        .marksObtained(l.getMarksObtained())
                        .maxMarks(l.getMaxMarks())
                        .build())
                .toList();

        List<StudentDashboardResponse.NoticeDTO> noticeDtos = noticesList.stream()
                .limit(10)
                .map(n -> StudentDashboardResponse.NoticeDTO.builder()
                        .title(n.getTitle())
                        .noticeDate(n.getNoticeDate())
                        .category(n.getCategory())
                        .linkUrl(n.getLinkUrl())
                        .description(n.getDescription())
                        .build())
                .toList();

        return StudentDashboardResponse.builder()
                .rollNo(profile.getRollNo())
                .fullName(profile.getFullName())
                .dob(profile.getDob())
                .profilePhotoUrl(profile.getProfilePhotoUrl())
                .gender(profile.getGender())
                .bloodGroup(profile.getBloodGroup())
                .email(profile.getEmail())
                .department(profile.getDepartment())
                .yearOfStudy(profile.getYearOfStudy())
                .semester(profile.getSemester())
                .section(profile.getSection())
                .overallAttendance(profile.getOverallAttendance())
                .attendanceStatus(status)
                .safeBunksAvailable(safeBunks)
                .classesNeededFor75(classesNeeded)
                .lastSyncedAt(profile.getLastSyncedAt())
                .attendance(attDtos)
                .todaySchedule(todayDtos)
                .weeklySchedule(weeklyDtos)
                .marks(marksDtos)
                .labSubmissions(labDtos)
                .notices(noticeDtos)
                .build();
    }

    private String getNormalizedAiServiceUrl() {
        if (aiServiceUrl == null || aiServiceUrl.isBlank()) {
            return "http://127.0.0.1:8001";
        }
        String trimmed = aiServiceUrl.trim().replaceAll("/+$", "");

        // Local development
        if (trimmed.contains("localhost") || trimmed.contains("127.0.0.1")) {
            if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                trimmed = "http://" + trimmed;
            }
            if (trimmed.indexOf(":", trimmed.indexOf("//") + 2) == -1) {
                trimmed = trimmed + ":8001";
            }
            return trimmed;
        }

        // If it already is a full HTTPS URL
        if (trimmed.startsWith("https://")) {
            return trimmed;
        }

        // If it starts with http:// but refers to Render service name
        if (trimmed.startsWith("http://")) {
            if (trimmed.contains("iare-agent-ai-service") && !trimmed.contains("onrender.com")) {
                return "https://iare-agent-ai-service.onrender.com";
            }
            return trimmed;
        }

        // Render free tier hostname -> https://<name>.onrender.com
        if (!trimmed.contains(".")) {
            return "https://" + trimmed + ".onrender.com";
        }

        return "https://" + trimmed;
    }

    private WebClient createWebClient(String baseUrl) {
        reactor.netty.http.client.HttpClient httpClient = reactor.netty.http.client.HttpClient.create()
                .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
                .responseTimeout(java.time.Duration.ofSeconds(45));

        return webClientBuilder
                .clientConnector(new org.springframework.http.client.reactive.ReactorClientHttpConnector(httpClient))
                .baseUrl(baseUrl)
                .build();
    }

    private Map<String, Object> callAiServiceScraper(String rollNo, String password) {
        try {
            WebClient client = createWebClient(getNormalizedAiServiceUrl());
            Map<String, String> payload = Map.of("roll_no", rollNo, "password", password);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri("/internal/samvidha/scrape-timetable")
                    .header("X-Internal-Secret", sharedSecret)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(java.time.Duration.ofSeconds(45));

            return response != null ? response : Map.of("success", false, "error", "Empty response from ai-service");
        } catch (Exception e) {
            log.warn("Direct WebClient call to ai-service scraper failed for {}: {}", rollNo, e.getMessage());
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    /**
     * Performs live session handshake and scraping against https://samvidha.iare.ac.in
     */
    public LiveSamvidhaResult performLiveSamvidhaExtraction(String rollNo, String password) {
        LiveSamvidhaResult result = new LiveSamvidhaResult();
        if (password == null || password.isBlank()) {
            return result;
        }

        try {
            CookieManager cookieManager = new CookieManager();
            cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

            HttpClient httpClient = HttpClient.newBuilder()
                    .cookieHandler(cookieManager)
                    .connectTimeout(Duration.ofSeconds(8))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            // 1. GET Homepage to capture session cookie (PHPSESSID) and CSRF token
            HttpRequest getHomeReq = HttpRequest.newBuilder()
                    .uri(URI.create(SAMVIDHA_BASE_URL))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .GET()
                    .timeout(Duration.ofSeconds(8))
                    .build();

            HttpResponse<String> getHomeRes = httpClient.send(getHomeReq, HttpResponse.BodyHandlers.ofString());
            String homeHtml = getHomeRes.body();

            String csrfToken = "";
            Matcher mMeta = CSRF_META_PATTERN.matcher(homeHtml);
            if (mMeta.find()) {
                csrfToken = mMeta.group(1);
            } else {
                Matcher mInp = CSRF_INPUT_PATTERN.matcher(homeHtml);
                if (mInp.find()) {
                    csrfToken = mInp.group(1);
                }
            }

            // 2. POST checkUser.php with session cookies and CSRF headers
            String formData = "username=" + URLEncoder.encode(rollNo, StandardCharsets.UTF_8)
                    + "&password=" + URLEncoder.encode(password, StandardCharsets.UTF_8);

            HttpRequest.Builder postBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(SAMVIDHA_LOGIN_ENDPOINT))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                    .header("Origin", SAMVIDHA_BASE_URL)
                    .header("Referer", SAMVIDHA_BASE_URL + "/")
                    .header("X-Requested-With", "XMLHttpRequest")
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .header("Accept", "*/*")
                    .POST(HttpRequest.BodyPublishers.ofString(formData))
                    .timeout(Duration.ofSeconds(8));

            if (!csrfToken.isBlank()) {
                postBuilder.header("X-CSRF-Token", csrfToken);
            }

            HttpResponse<String> postRes = httpClient.send(postBuilder.build(), HttpResponse.BodyHandlers.ofString());
            String postBody = postRes.body();
            log.info("Samvidha login check response: {}", postBody);

            if (postBody != null && !postBody.isBlank()) {
                JsonNode json = objectMapper.readTree(postBody);
                String statusStr = json.path("status").asText();
                String msg = json.path("msg").asText("Invalid credentials");

                if ("1".equals(statusStr)) {
                    result.authenticated = true;
                    log.info("Live Samvidha login SUCCESS for roll: {}", rollNo);

                    // 3. Check if login JSON response directly provided student name
                    String jsonName = json.path("name").asText(
                            json.path("student_name").asText(
                                    json.path("user_name").asText(
                                            json.path("fullname").asText(
                                                    json.path("studentName").asText("")
                                            )
                                    )
                                )
                    );
                    if (!jsonName.isBlank()) {
                        String clean = cleanExtractedName(jsonName, rollNo);
                        if (isValidStudentName(clean, rollNo)) {
                            result.fullName = formatProperCase(clean);
                            log.info("Extracted student name from Samvidha JSON: {}", result.fullName);
                        }
                    }

                    // 4. GET authenticated dashboard / home page
                    HttpRequest authHomeReq = HttpRequest.newBuilder()
                            .uri(URI.create(SAMVIDHA_BASE_URL + "/home"))
                            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
                            .header("Referer", SAMVIDHA_BASE_URL + "/")
                            .GET()
                            .timeout(Duration.ofSeconds(8))
                            .build();

                    HttpResponse<String> authHomeRes = httpClient.send(authHomeReq, HttpResponse.BodyHandlers.ofString());
                    String authHtml = authHomeRes.body();

                    // Parse name, photo, etc. from live HTML (targeting top-right corner user menu)
                    parseLiveHomeHtml(authHtml, result, rollNo);
                    result.parsedSuccessfully = true;
                } else if ("0".equals(statusStr) || "2".equals(statusStr)) {
                    result.authenticated = false;
                    log.warn("Live Samvidha login rejected: {}", msg);
                    throw new BadCredentialsException("Invalid Samvidha credentials: " + msg);
                }
            }
        } catch (BadCredentialsException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Samvidha live connection exception: {}", e.getMessage());
        }

        return result;
    }

    public void parseLiveHomeHtml(String html, LiveSamvidhaResult result, String rollNo) {
        if (html == null || html.isBlank()) return;

        if (result.fullName == null || result.fullName.isBlank()) {
            String extractedName = extractStudentNameFromSamvidha(html, rollNo);
            if (extractedName != null && !extractedName.isBlank()) {
                result.fullName = extractedName;
                log.info("Successfully extracted right-corner student name from Samvidha: {}", extractedName);
            }
        }

        if (result.photoUrl == null || result.photoUrl.isBlank()) {
            String extractedPhoto = extractPhotoUrlFromSamvidha(html);
            if (extractedPhoto != null && !extractedPhoto.isBlank()) {
                result.photoUrl = extractedPhoto;
            }
        }
    }

    public static String extractStudentNameFromSamvidha(String html, String rollNo) {
        if (html == null || html.isBlank()) return null;

        String cleanRoll = rollNo != null ? rollNo.trim().toUpperCase() : "";

        Pattern[] rightCornerPatterns = new Pattern[] {
            Pattern.compile("<(?:li|div)[^>]*class=[\"'][^\"']*(?:user-menu|navbar-custom-menu|user-panel)[^\"']*[\"'][^>]*>[\\s\\S]*?<span[^>]*class=[\"'][^\"']*hidden-xs[^\"']*[\"'][^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<li[^>]*class=[\"'][^\"']*dropdown\\s+user[^\"]*[\"'][^>]*>[\\s\\S]*?<span[^>]*class=[\"'][^\"']*hidden-xs[^\"']*[\"'][^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<a[^>]*class=[\"'][^\"']*dropdown-toggle[^\"']*[\"'][^>]*>[\\s\\S]*?<span[^>]*class=[\"'][^\"']*hidden-xs[^\"']*[\"'][^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<li[^>]*class=[\"'][^\"']*user-header[^\"']*[\"'][^>]*>[\\s\\S]*?<p[^>]*>([A-Za-z\\s.]+?)(?:<|\\s*-\\s*|\\s*\\()", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<(?:div|ul|nav)[^>]*class=[\"'][^\"']*(?:navbar-right|pull-right|ms-auto|ml-auto|float-right|top-nav|header-right)[^\"']*[\"'][^>]*>[\\s\\S]*?<span[^>]*class=[\"'][^\"']*(?:user-name|username|profile-name|d-none|name)[^\"']*[\"'][^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<(?:div|ul|nav)[^>]*class=[\"'][^\"']*(?:navbar-right|pull-right|ms-auto|ml-auto|float-right|top-nav|header-right)[^\"']*[\"'][^>]*>[\\s\\S]*?<p[^>]*class=[\"'][^\"']*(?:user-name|username|name)[^\"']*[\"'][^>]*>([^<]+)</p>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("<div[^>]*class=[\"'][^\"']*user-panel[^\"']*[\"'][^>]*>[\\s\\S]*?<div[^>]*class=[\"'][^\"']*info[^\"']*[\"'][^>]*>[\\s\\S]*?<p[^>]*>([^<]+)</p>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("id=[\"'](?:lblStudentName|lbl_name|lblUserName|user_name|student_name|lbl_student|lblFullName)[\"'][^>]*>([^<]+)<", Pattern.CASE_INSENSITIVE),
            Pattern.compile("class=[\"'](?:profile-username|student-name|user-name|username)[\"'][^>]*>([^<]+)<", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome,?\\s*<span[^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome,?\\s*<b[^>]*>([^<]+)</b>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome,?\\s*<strong[^>]*>([^<]+)</strong>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome\\s*:\\s*<b[^>]*>([^<]+)</b>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome\\s*:\\s*<span[^>]*>([^<]+)</span>", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome\\s*:\\s*([^<\\n\\r]+)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("Welcome,?\\s+([^<\\n\\r|]{3,60})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("([^<\\n\\r]{3,60}?)\\s*\\(\\s*(?:2[0-9][0-9]{3}[A-Za-z0-9]{4}|[0-9]{10})\\s*\\)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:2[0-9][0-9]{3}[A-Za-z0-9]{4}|[0-9]{10})\\s*[-–:]\\s*([^<\\n\\r]{3,60})", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:Student\\s+Name|Name)\\s*[:\\-]\\s*<[^>]*>([^<]+)<", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(?:Student\\s+Name|Name)\\s*[:\\-]\\s*([^<\\n\\r]{3,60})", Pattern.CASE_INSENSITIVE)
        };

        for (Pattern p : rightCornerPatterns) {
            Matcher m = p.matcher(html);
            while (m.find()) {
                String candidate = cleanExtractedName(m.group(1), cleanRoll);
                if (isValidStudentName(candidate, cleanRoll)) {
                    return formatProperCase(candidate);
                }
            }
        }

        return null;
    }

    public static String extractPhotoUrlFromSamvidha(String html) {
        if (html == null || html.isBlank()) return null;
        Matcher mPhoto = PHOTO_PATTERN.matcher(html);
        if (mPhoto.find()) {
            String photoPath = mPhoto.group(1);
            if (!photoPath.startsWith("http")) {
                photoPath = SAMVIDHA_BASE_URL + "/" + (photoPath.startsWith("/") ? photoPath.substring(1) : photoPath);
            }
            return photoPath;
        }
        return null;
    }

    public static String cleanExtractedName(String raw, String rollNo) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("<[^>]*>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("&amp;", "&")
                .replaceAll("&#39;", "'")
                .replaceAll("&quot;", "\"")
                .trim();

        cleaned = cleaned.replaceFirst("^(?i)(?:Welcome|Hello|Hi|Student|User|Mr\\.?|Ms\\.?|Dr\\.?)\\s*[,:\\-]?\\s*", "");
        cleaned = cleaned.replaceFirst("\\s*\\([^)]*\\)$", "");
        cleaned = cleaned.replaceFirst("\\s*[-–|].*$", "");
        cleaned = cleaned.replaceAll("\\s+", " ").trim();

        if (rollNo != null && !rollNo.isBlank()) {
            cleaned = cleaned.replaceAll("(?i)" + Pattern.quote(rollNo), "").trim();
        }

        return cleaned;
    }

    public static boolean isValidStudentName(String name, String rollNo) {
        if (name == null || name.isBlank()) return false;
        if (name.length() < 3 || name.length() > 60) return false;
        if (rollNo != null && name.equalsIgnoreCase(rollNo)) return false;

        if (!name.matches(".*[A-Za-z]{2,}.*")) return false;
        String lower = name.toLowerCase();
        if (lower.equals("logout") || lower.equals("home") || lower.equals("dashboard") ||
            lower.equals("profile") || lower.equals("student") || lower.equals("user") ||
            lower.equals("null") || lower.equals("undefined") || lower.equals("notifications") ||
            lower.equals("samvidha") || lower.equals("login") || lower.equals("sign in")) {
            return false;
        }

        return true;
    }

    public static String formatProperCase(String name) {
        if (name == null || name.isBlank()) return "";
        if (name.equals(name.toUpperCase()) || name.equals(name.toLowerCase())) {
            String[] words = name.trim().split("\\s+");
            StringBuilder sb = new StringBuilder();
            for (String w : words) {
                if (w.isEmpty()) continue;
                if (sb.length() > 0) sb.append(" ");
                sb.append(Character.toUpperCase(w.charAt(0)));
                if (w.length() > 1) {
                    sb.append(w.substring(1).toLowerCase());
                }
            }
            return sb.toString();
        }
        return name.trim();
    }

    /**
     * Applies REAL scraped data from ai-service Python scraper to the student profile.
     */
    @SuppressWarnings("unchecked")
    private void applyRealScrapedData(StudentProfile profile, Map<String, Object> scraperResult, String rollNo) {
        log.info("Applying REAL scraped data from ai-service for: {}", rollNo);

        String fullName = (String) scraperResult.get("full_name");
        if (fullName != null && !fullName.isBlank()) {
            profile.setFullName(fullName);
        }

        String photoUrl = (String) scraperResult.get("profile_photo_url");
        if (photoUrl != null && !photoUrl.isBlank()) {
            profile.setProfilePhotoUrl(photoUrl);
        }

        String department = (String) scraperResult.get("department");
        if (department != null && !department.isBlank()) {
            profile.setDepartment(department);
        }

        Object semObj = scraperResult.get("semester");
        if (semObj != null) {
            profile.setSemester(((Number) semObj).intValue());
        }

        Object yearObj = scraperResult.get("year_of_study");
        if (yearObj != null) {
            profile.setYearOfStudy(((Number) yearObj).intValue());
        }

        String section = (String) scraperResult.get("section");
        if (section != null && !section.isBlank()) {
            profile.setSection(section);
        }

        String dob = (String) scraperResult.get("dob");
        if (dob != null && !dob.isBlank()) {
            profile.setDob(dob);
        }

        String gender = (String) scraperResult.get("gender");
        if (gender != null && !gender.isBlank()) {
            profile.setGender(gender);
        }

        String bloodGroup = (String) scraperResult.get("blood_group");
        if (bloodGroup != null && !bloodGroup.isBlank()) {
            profile.setBloodGroup(bloodGroup);
        }

        Object overallAtt = scraperResult.get("overall_attendance");
        if (overallAtt != null) {
            profile.setOverallAttendance(((Number) overallAtt).doubleValue());
        }

        profile.setEmail(rollNo.toLowerCase() + "@iare.ac.in");

        // --- REAL Attendance from scraped portal data ---
        profile.getAttendanceRecords().clear();
        List<Map<String, Object>> attendanceEntries = (List<Map<String, Object>>) scraperResult.get("attendance");
        if (attendanceEntries != null && !attendanceEntries.isEmpty()) {
            for (Map<String, Object> entry : attendanceEntries) {
                String code = (String) entry.getOrDefault("subject_code", "");
                String name = (String) entry.getOrDefault("subject_name", "");
                int total = entry.get("total_classes") != null ? ((Number) entry.get("total_classes")).intValue() : 0;
                int attended = entry.get("attended_classes") != null ? ((Number) entry.get("attended_classes")).intValue() : 0;
                double pct = entry.get("percentage") != null ? ((Number) entry.get("percentage")).doubleValue() : 0.0;

                profile.getAttendanceRecords().add(StudentAttendance.builder()
                        .studentProfile(profile)
                        .subjectCode(code)
                        .subjectName(name)
                        .totalClasses(total)
                        .attendedClasses(attended)
                        .percentage(pct)
                        .build());
            }
        }

        // --- REAL Timetable ---
        profile.getTimetableSlots().clear();
        List<Map<String, Object>> timetableEntries = (List<Map<String, Object>>) scraperResult.get("timetable");
        if (timetableEntries != null && !timetableEntries.isEmpty()) {
            for (Map<String, Object> entry : timetableEntries) {
                profile.getTimetableSlots().add(StudentTimetable.builder()
                        .studentProfile(profile)
                        .dayOfWeek(((Number) entry.getOrDefault("day_of_week", 0)).intValue())
                        .timeSlotStart((String) entry.getOrDefault("time_slot_start", "09:00"))
                        .timeSlotEnd((String) entry.getOrDefault("time_slot_end", "10:40"))
                        .subjectCode((String) entry.getOrDefault("subject_code", ""))
                        .subjectName((String) entry.getOrDefault("subject_name", ""))
                        .room((String) entry.getOrDefault("room", "TBA"))
                        .facultyName((String) entry.getOrDefault("faculty_name", "TBA"))
                        .build());
            }
        }

        // --- REAL CIE Marks ---
        profile.getMarksRecords().clear();
        List<Map<String, Object>> marksEntries = (List<Map<String, Object>>) scraperResult.get("marks");
        if (marksEntries != null && !marksEntries.isEmpty()) {
            for (Map<String, Object> entry : marksEntries) {
                profile.getMarksRecords().add(StudentMarks.builder()
                        .studentProfile(profile)
                        .subjectCode((String) entry.getOrDefault("subject_code", ""))
                        .subjectName((String) entry.getOrDefault("subject_name", ""))
                        .cie1(parseDoubleSafely(entry.get("cie1")))
                        .cie2(parseDoubleSafely(entry.get("cie2")))
                        .internalTotal(parseDoubleSafely(entry.get("internal_total")))
                        .build());
            }
        }

        // --- REAL Lab Submissions ---
        profile.getLabSubmissions().clear();
        List<Map<String, Object>> labEntries = (List<Map<String, Object>>) scraperResult.get("lab_submissions");
        if (labEntries != null && !labEntries.isEmpty()) {
            for (Map<String, Object> entry : labEntries) {
                profile.getLabSubmissions().add(StudentLabSubmission.builder()
                        .studentProfile(profile)
                        .subjectCode((String) entry.getOrDefault("subject_code", ""))
                        .subjectName((String) entry.getOrDefault("subject_name", ""))
                        .experimentName((String) entry.getOrDefault("experiment_name", "Experiment"))
                        .dueDate((String) entry.getOrDefault("due_date", "Upcoming"))
                        .status((String) entry.getOrDefault("status", "PENDING"))
                        .marksObtained(parseDoubleSafely(entry.get("marks_obtained")))
                        .maxMarks(entry.get("max_marks") != null ? parseDoubleSafely(entry.get("max_marks")) : 10.0)
                        .build());
            }
        }
    }

    private static Double parseDoubleSafely(Object val) {
        if (val == null) return null;
        if (val instanceof Number n) return n.doubleValue();
        try {
            String s = val.toString().replaceAll("[^0-9.]", "").trim();
            return s.isEmpty() ? null : Double.parseDouble(s);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Refreshes real campus notices and placement drives from Samvidha homepage.
     */
    @Transactional
    public void refreshSamvidhaNotices() {
        try {
            if (noticeRepository.count() > 0) {
                return;
            }

            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
            HttpRequest req = HttpRequest.newBuilder().uri(URI.create(SAMVIDHA_BASE_URL)).GET().build();
            HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());

            List<SamvidhaNotice> notices = new ArrayList<>();
            String html = res.body();

            Matcher mPlacement = Pattern.compile("<a[^>]*href=[\"']([^\"']*)[\"'][^>]*>(.*?)</a>(?:\\s*<span>(.*?)</span>)?", Pattern.CASE_INSENSITIVE).matcher(html);
            while (mPlacement.find() && notices.size() < 10) {
                String title = mPlacement.group(2).replaceAll("<[^>]*>", "").trim();
                String date = mPlacement.group(3) != null ? mPlacement.group(3).trim() : "Recent";
                String link = mPlacement.group(1);
                if (title.length() > 5) {
                    notices.add(SamvidhaNotice.builder()
                            .title(title)
                            .noticeDate(date)
                            .category(title.toLowerCase().contains("placement") || title.toLowerCase().contains("recruitment") ? "PLACEMENT" : "ACADEMIC")
                            .linkUrl(link.startsWith("http") ? link : SAMVIDHA_BASE_URL + "/" + link)
                            .description("Official Samvidha notice from IARE portal.")
                            .build());
                }
            }

            if (!notices.isEmpty()) {
                noticeRepository.saveAll(notices);
            }
        } catch (Exception e) {
            log.warn("Samvidha notices scrape error: {}", e.getMessage());
        }
    }

    public static class LiveSamvidhaResult {
        public boolean authenticated = false;
        public boolean parsedSuccessfully = false;
        public String fullName;
        public String photoUrl;
    }
}
