package in.iare.agent.service;

import in.iare.agent.dto.*;
import in.iare.agent.model.*;
import in.iare.agent.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service managing extracted Telegram events, audience cohort matching,
 * priority alert notifications, and student event feeds.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EventService {

    private final EventRepository eventRepository;
    private final StudentEventNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final StudentOnboardingRepository onboardingRepository;
    private final StudentProfileRepository profileRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public EventDto ingestEvent(EventIngestRequest req) {
        log.info("Ingesting Telegram event: '{}' (group={}, msg={}, mandatory={}, targetSem={}, targetBranch={})",
                req.getTitle(), req.getSourceTelegramGroupId(), req.getSourceTelegramMessageId(),
                req.isMandatory(), req.getTargetSemester(), req.getTargetBranch());

        // Deduplicate based on source telegram group & message ID
        Event event = null;
        if (req.getSourceTelegramGroupId() != null && req.getSourceTelegramMessageId() != null) {
            event = eventRepository.findBySourceTelegramGroupIdAndSourceTelegramMessageId(
                    req.getSourceTelegramGroupId(), req.getSourceTelegramMessageId()
            ).orElse(null);
        }

        if (event == null) {
            event = Event.builder()
                    .sourceTelegramGroupId(req.getSourceTelegramGroupId())
                    .sourceTelegramMessageId(req.getSourceTelegramMessageId())
                    .title(req.getTitle() != null ? req.getTitle().trim() : "Campus Event")
                    .description(req.getDescription())
                    .rawText(req.getRawText())
                    .hasImage(req.isHasImage())
                    .imageUrl(req.getImageUrl())
                    .eventDate(req.getEventDate() != null ? req.getEventDate() : "Upcoming")
                    .eventTime(req.getEventTime())
                    .location(req.getLocation() != null ? req.getLocation() : "IARE Campus")
                    .organizer(req.getOrganizer() != null ? req.getOrganizer() : "IARE Department")
                    .targetSemester(req.getTargetSemester())
                    .targetBranch(req.getTargetBranch())
                    .targetSection(req.getTargetSection())
                    .targetAudienceRaw(req.getTargetAudienceRaw() != null ? req.getTargetAudienceRaw() : "All Students")
                    .mandatory(req.isMandatory())
                    .registrationDeadline(req.getRegistrationDeadline())
                    .actionUrl(req.getActionUrl())
                    .build();
        } else {
            event.setTitle(req.getTitle() != null ? req.getTitle().trim() : event.getTitle());
            event.setDescription(req.getDescription() != null ? req.getDescription() : event.getDescription());
            event.setEventDate(req.getEventDate() != null ? req.getEventDate() : event.getEventDate());
            event.setLocation(req.getLocation() != null ? req.getLocation() : event.getLocation());
            event.setMandatory(req.isMandatory());
            event.setActionUrl(req.getActionUrl() != null ? req.getActionUrl() : event.getActionUrl());
        }

        Event saved = eventRepository.save(event);

        // If event is mandatory, generate priority notifications and reminders for matching students
        if (saved.isMandatory()) {
            dispatchMandatoryNotifications(saved);
        }

        return toDto(saved);
    }

    /**
     * Matches target audience and creates immediate alerts and scheduled reminders for matching students.
     */
    private void dispatchMandatoryNotifications(Event event) {
        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .collect(Collectors.toList());

        int count = 0;
        for (User student : students) {
            if (isStudentInTargetAudience(student, event)) {
                // 1. Immediate in-app alert
                if (notificationRepository.findByUserAndEventAndNotificationType(student, event, "IMMEDIATE_ALERT").isEmpty()) {
                    notificationRepository.save(StudentEventNotification.builder()
                            .user(student)
                            .event(event)
                            .notificationType("IMMEDIATE_ALERT")
                            .title("🚨 Mandatory Action: " + event.getTitle())
                            .message("A mandatory placement drive/academic deadline requires your action: " +
                                    event.getTitle() + " (" + event.getEventDate() + " at " + event.getLocation() + ")")
                            .read(false)
                            .sentAt(Instant.now())
                            .build());
                    count++;
                }

                // 2. Upcoming reminder (~24h before deadline if lead time >= 48h)
                if (event.getRegistrationDeadline() != null) {
                    Duration leadTime = Duration.between(Instant.now(), event.getRegistrationDeadline());
                    if (leadTime.toHours() >= 48) {
                        Instant reminderTime = event.getRegistrationDeadline().minus(Duration.ofHours(24));
                        if (notificationRepository.findByUserAndEventAndNotificationType(student, event, "UPCOMING_REMINDER").isEmpty()) {
                            notificationRepository.save(StudentEventNotification.builder()
                                    .user(student)
                                    .event(event)
                                    .notificationType("UPCOMING_REMINDER")
                                    .title("⏰ Reminder (24h Remaining): " + event.getTitle())
                                    .message("Reminder: Tomorrow is the registration deadline for mandatory event: " + event.getTitle())
                                    .read(false)
                                    .scheduledFor(reminderTime)
                                    .sentAt(Instant.now())
                                    .build());
                        }
                    }
                }
            }
        }
        log.info("Dispatched mandatory event notifications to {} matching students for event ID {}", count, event.getId());
    }

    /**
     * Audience targeting engine: checks student's semester, branch, section against event criteria.
     * Permissive rule: if event criteria are null/unspecified, includes all students.
     */
    public boolean isStudentInTargetAudience(User student, Event event) {
        Integer studentSem = null;
        String studentBranch = null;
        String studentSection = null;

        Optional<StudentOnboarding> obOpt = onboardingRepository.findByUser(student);
        if (obOpt.isPresent()) {
            studentSem = obOpt.get().getSemester();
            studentBranch = obOpt.get().getBranch();
            studentSection = obOpt.get().getSection();
        }

        if (studentSem == null || studentBranch == null) {
            Optional<StudentProfile> pOpt = profileRepository.findByUser(student);
            if (pOpt.isPresent()) {
                if (studentSem == null) studentSem = pOpt.get().getSemester();
                if (studentBranch == null) studentBranch = pOpt.get().getDepartment();
                if (studentSection == null) studentSection = pOpt.get().getSection();
            }
        }

        // 1. Check Semester
        if (event.getTargetSemester() != null && studentSem != null) {
            if (!event.getTargetSemester().equals(studentSem)) {
                return false;
            }
        }

        // 2. Check Branch / Department
        if (event.getTargetBranch() != null && studentBranch != null) {
            String targetB = event.getTargetBranch().trim().toLowerCase();
            String stdB = studentBranch.trim().toLowerCase();
            boolean branchMatch = stdB.contains(targetB) || targetB.contains(stdB) ||
                    (targetB.equals("cse") && stdB.contains("computer science")) ||
                    (targetB.equals("ece") && stdB.contains("electronics")) ||
                    (targetB.equals("it") && stdB.contains("information technology")) ||
                    (targetB.equals("me") && stdB.contains("mechanical")) ||
                    (targetB.equals("ae") && stdB.contains("aeronautical")) ||
                    (targetB.equals("ce") && stdB.contains("civil")) ||
                    (targetB.equals("eee") && stdB.contains("electrical"));
            if (!branchMatch) {
                return false;
            }
        }

        // 3. Check Section
        if (event.getTargetSection() != null && studentSection != null) {
            if (!event.getTargetSection().trim().equalsIgnoreCase(studentSection.trim())) {
                return false;
            }
        }

        return true;
    }

    @Transactional(readOnly = true)
    public List<EventDto> getEventsForStudent(User user, Boolean mandatoryOnly, Boolean upcomingOnly) {
        Integer studentSem = null;
        String studentBranch = null;

        if (user != null) {
            Optional<StudentOnboarding> obOpt = onboardingRepository.findByUser(user);
            if (obOpt.isPresent()) {
                studentSem = obOpt.get().getSemester();
                studentBranch = obOpt.get().getBranch();
            }
            if (studentSem == null || studentBranch == null) {
                Optional<StudentProfile> pOpt = profileRepository.findByUser(user);
                if (pOpt.isPresent()) {
                    if (studentSem == null) studentSem = pOpt.get().getSemester();
                    if (studentBranch == null) studentBranch = pOpt.get().getDepartment();
                }
            }
        }

        List<Event> allEvents = eventRepository.findAllByOrderByCreatedAtDesc();

        return allEvents.stream()
                .filter(e -> {
                    if (Boolean.TRUE.equals(mandatoryOnly) && !e.isMandatory()) {
                        return false;
                    }
                    if (user != null && !isStudentInTargetAudience(user, e)) {
                        return false;
                    }
                    return true;
                })
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EventsFeedResponse getEventsFeed(User user, Boolean mandatoryOnly) {
        List<EventDto> events = getEventsForStudent(user, mandatoryOnly, false);
        long mandatoryCount = events.stream().filter(EventDto::isMandatory).count();

        List<StudentNotificationDto> unread = Collections.emptyList();
        if (user != null) {
            unread = getUnreadNotifications(user);
        }

        return EventsFeedResponse.builder()
                .events(events)
                .totalCount(events.size())
                .mandatoryCount((int) mandatoryCount)
                .unreadNotifications(unread)
                .build();
    }

    @Transactional(readOnly = true)
    public List<StudentNotificationDto> getUnreadNotifications(User user) {
        return notificationRepository.findByUserAndReadFalseOrderByCreatedAtDesc(user).stream()
                .map(this::toNotificationDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markNotificationAsRead(Long notificationId, User user) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getUser().getId().equals(user.getId())) {
                n.setRead(true);
                notificationRepository.save(n);
            }
        });
    }

    private EventDto toDto(Event e) {
        return EventDto.builder()
                .id(e.getId())
                .sourceTelegramGroupId(e.getSourceTelegramGroupId())
                .sourceTelegramMessageId(e.getSourceTelegramMessageId())
                .title(e.getTitle())
                .description(e.getDescription())
                .rawText(e.getRawText())
                .hasImage(e.isHasImage())
                .imageUrl(e.getImageUrl())
                .eventDate(e.getEventDate())
                .eventTime(e.getEventTime())
                .location(e.getLocation())
                .organizer(e.getOrganizer())
                .targetSemester(e.getTargetSemester())
                .targetBranch(e.getTargetBranch())
                .targetSection(e.getTargetSection())
                .targetAudienceRaw(e.getTargetAudienceRaw())
                .mandatory(e.isMandatory())
                .registrationDeadline(e.getRegistrationDeadline())
                .actionUrl(e.getActionUrl())
                .createdAt(e.getCreatedAt())
                .build();
    }

    private StudentNotificationDto toNotificationDto(StudentEventNotification n) {
        Event e = n.getEvent();
        return StudentNotificationDto.builder()
                .id(n.getId())
                .eventId(e != null ? e.getId() : null)
                .eventTitle(e != null ? e.getTitle() : n.getTitle())
                .eventDate(e != null ? e.getEventDate() : null)
                .eventLocation(e != null ? e.getLocation() : null)
                .actionUrl(e != null ? e.getActionUrl() : null)
                .mandatory(e != null && e.isMandatory())
                .notificationType(n.getNotificationType())
                .title(n.getTitle())
                .message(n.getMessage())
                .read(n.isRead())
                .scheduledFor(n.getScheduledFor())
                .sentAt(n.getSentAt())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
