package in.iare.agent;

import in.iare.agent.dto.EventDto;
import in.iare.agent.dto.EventIngestRequest;
import in.iare.agent.dto.EventsFeedResponse;
import in.iare.agent.dto.StudentNotificationDto;
import in.iare.agent.model.Role;
import in.iare.agent.model.StudentOnboarding;
import in.iare.agent.model.User;
import in.iare.agent.repository.EventRepository;
import in.iare.agent.repository.StudentEventNotificationRepository;
import in.iare.agent.repository.StudentOnboardingRepository;
import in.iare.agent.repository.UserRepository;
import in.iare.agent.service.EventService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestPropertySource(properties = {
    "app.jwt.secret=dGVzdC1zZWNyZXQtMzItY2hhcnMtbG9uZy1rZXktaGVyZQ==",
    "app.ai-service.shared-secret=test-shared-secret",
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "app.cors.allowed-origins=http://localhost:5173"
})
@Transactional
class TelegramEventIntelligenceTests {

    @Autowired
    private EventService eventService;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private StudentEventNotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentOnboardingRepository onboardingRepository;

    private User sem5Student;
    private User sem3Student;

    @BeforeEach
    void setUp() {
        // Create Semester 5 CSE Student
        sem5Student = userRepository.saveAndFlush(User.builder()
                .email("22951a0501@iare.ac.in")
                .passwordHash("$2a$10$testHash")
                .fullName("Vikram Reddy")
                .role(Role.STUDENT)
                .onboardingCompleted(true)
                .build());

        onboardingRepository.saveAndFlush(StudentOnboarding.builder()
                .user(sem5Student)
                .semester(5)
                .branch("Computer Science and Engineering (CSE)")
                .section("A")
                .build());

        // Create Semester 3 CSE Student
        sem3Student = userRepository.saveAndFlush(User.builder()
                .email("23951a0599@iare.ac.in")
                .passwordHash("$2a$10$testHash")
                .fullName("Priya Sharma")
                .role(Role.STUDENT)
                .onboardingCompleted(true)
                .build());

        onboardingRepository.saveAndFlush(StudentOnboarding.builder()
                .user(sem3Student)
                .semester(3)
                .branch("Computer Science and Engineering (CSE)")
                .section("B")
                .build());
    }

    @Test
    void testMandatoryDriveTargetingSemester5() {
        EventIngestRequest req = EventIngestRequest.builder()
                .sourceTelegramGroupId(-1002345678901L)
                .sourceTelegramMessageId(555L)
                .title("TCS National Qualifier Test (NQT) Drive")
                .description("Mandatory registration for all V Sem CSE & IT students.")
                .eventDate("Tomorrow 10:00 AM")
                .location("Auditorium")
                .organizer("Training & Placement Cell")
                .targetSemester(5)
                .targetBranch("CSE")
                .targetAudienceRaw("V Sem CSE Students")
                .mandatory(true)
                .actionUrl("https://iare.ac.in/placements/tcs")
                .build();

        EventDto ingested = eventService.ingestEvent(req);
        assertNotNull(ingested.getId());
        assertTrue(ingested.isMandatory());
        assertEquals(5, ingested.getTargetSemester());

        // Verify Sem 5 student receives notification
        List<StudentNotificationDto> sem5Notifs = eventService.getUnreadNotifications(sem5Student);
        assertFalse(sem5Notifs.isEmpty(), "Sem 5 student should receive mandatory event alert");
        assertEquals("IMMEDIATE_ALERT", sem5Notifs.get(0).getNotificationType());
        assertTrue(sem5Notifs.get(0).getTitle().contains("TCS National Qualifier Test"));

        // Verify Sem 3 student receives 0 notifications (not their cohort)
        List<StudentNotificationDto> sem3Notifs = eventService.getUnreadNotifications(sem3Student);
        assertTrue(sem3Notifs.isEmpty(), "Sem 3 student should NOT receive Sem 5 targeted notification");

        // Verify Events feed filtering
        List<EventDto> sem5Feed = eventService.getEventsForStudent(sem5Student, false, false);
        assertEquals(1, sem5Feed.size());

        List<EventDto> sem3Feed = eventService.getEventsForStudent(sem3Student, false, false);
        assertEquals(0, sem3Feed.size());
    }

    @Test
    void testInformationalEventTargetingAllStudents() {
        EventIngestRequest req = EventIngestRequest.builder()
                .sourceTelegramGroupId(-1001234567890L)
                .sourceTelegramMessageId(777L)
                .title("Annual Hackathon TechAero 2026")
                .description("Open to all engineering students.")
                .eventDate("September 15")
                .location("Block B Seminar Hall")
                .organizer("Coding Club")
                .targetSemester(null) // All semesters
                .targetBranch(null)   // All branches
                .targetAudienceRaw("All Students")
                .mandatory(false)
                .build();

        EventDto ingested = eventService.ingestEvent(req);
        assertNotNull(ingested.getId());
        assertFalse(ingested.isMandatory());

        // Non-mandatory events must NOT trigger interrupt notifications
        List<StudentNotificationDto> notifs1 = eventService.getUnreadNotifications(sem5Student);
        List<StudentNotificationDto> notifs2 = eventService.getUnreadNotifications(sem3Student);
        assertTrue(notifs1.isEmpty());
        assertTrue(notifs2.isEmpty());

        // But must appear in both student event feeds
        EventsFeedResponse feed1 = eventService.getEventsFeed(sem5Student, false);
        EventsFeedResponse feed2 = eventService.getEventsFeed(sem3Student, false);
        assertEquals(1, feed1.getTotalCount());
        assertEquals(1, feed2.getTotalCount());
        assertEquals(0, feed1.getMandatoryCount());
    }

    @Test
    void testLeadTimeReminderScheduling() {
        Instant deadline72h = Instant.now().plus(Duration.ofHours(72));

        EventIngestRequest req = EventIngestRequest.builder()
                .sourceTelegramGroupId(-1002345678901L)
                .sourceTelegramMessageId(888L)
                .title("Cognizant GenC Drive Registration")
                .description("Compulsory registration for V Sem.")
                .eventDate("3 Days Later")
                .targetSemester(5)
                .targetBranch("CSE")
                .mandatory(true)
                .registrationDeadline(deadline72h)
                .build();

        eventService.ingestEvent(req);

        // Sem 5 student should have both IMMEDIATE_ALERT and UPCOMING_REMINDER
        var notifs = notificationRepository.findByUserOrderByCreatedAtDesc(sem5Student);
        assertEquals(2, notifs.size(), "Both immediate alert and 24h reminder should be created for leadTime >= 48h");
        assertTrue(notifs.stream().anyMatch(n -> "IMMEDIATE_ALERT".equals(n.getNotificationType())));
        assertTrue(notifs.stream().anyMatch(n -> "UPCOMING_REMINDER".equals(n.getNotificationType())));
    }

    @Test
    void testMarkNotificationAsRead() {
        EventIngestRequest req = EventIngestRequest.builder()
                .sourceTelegramGroupId(-1002345678901L)
                .sourceTelegramMessageId(999L)
                .title("CIE-I Exam Time Table Released")
                .eventDate("Monday")
                .targetSemester(5)
                .mandatory(true)
                .build();

        eventService.ingestEvent(req);

        List<StudentNotificationDto> unreadBefore = eventService.getUnreadNotifications(sem5Student);
        assertEquals(1, unreadBefore.size());

        Long notifId = unreadBefore.get(0).getId();
        eventService.markNotificationAsRead(notifId, sem5Student);

        List<StudentNotificationDto> unreadAfter = eventService.getUnreadNotifications(sem5Student);
        assertEquals(0, unreadAfter.size(), "Notification should be marked read");
    }
}
