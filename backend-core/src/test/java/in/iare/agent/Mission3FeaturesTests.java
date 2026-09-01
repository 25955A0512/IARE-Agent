package in.iare.agent;

import in.iare.agent.dto.ChatMessageDto;
import in.iare.agent.dto.ChatSessionDto;
import in.iare.agent.dto.OnboardingSurveyRequest;
import in.iare.agent.dto.OnboardingSurveyResponse;
import in.iare.agent.model.ChatSession;
import in.iare.agent.model.Role;
import in.iare.agent.model.StudentOnboarding;
import in.iare.agent.model.User;
import in.iare.agent.repository.StudentOnboardingRepository;
import in.iare.agent.repository.UserRepository;
import in.iare.agent.service.ChatMemoryService;
import in.iare.agent.service.OnboardingService;
import in.iare.agent.service.WeaknessService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

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
class Mission3FeaturesTests {

    @Autowired
    private OnboardingService onboardingService;

    @Autowired
    private StudentOnboardingRepository onboardingRepository;

    @Autowired
    private ChatMemoryService chatMemoryService;

    @Autowired
    private WeaknessService weaknessService;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.saveAndFlush(User.builder()
                .email("21951a0599@iare.ac.in")
                .passwordHash("$2a$10$testHash")
                .fullName("Rahul Sharma")
                .role(Role.STUDENT)
                .onboardingCompleted(false)
                .build());
    }

    @Test
    void testOnboardingSurveySkipPath() {
        OnboardingSurveyRequest req = OnboardingSurveyRequest.builder()
                .semester(4)
                .branch("Computer Science and Engineering (CSE)")
                .section("B")
                .enrolledCourses(List.of("Data Structures", "Operating Systems", "Discrete Mathematics"))
                .difficultSubjects(List.of("Theory of Computation", "Compiler Design"))
                .collegeGoals("Crack Tier-1 Product Placement")
                .technicalInterests("AI/ML, Fullstack Web Development")
                .clubsActivities("Coding Club, Robotics")
                .preferredNotificationTimes("Morning 8:00 AM")
                .monitoredTelegramGroups("IARE CSE 2026 Official, Placement Alerts")
                .checkInFrequency("DAILY_BRIEF")
                .moodCheckInsAllowed(true)
                .connectSamvidha(false)
                .build();

        OnboardingSurveyResponse resp = onboardingService.saveOnboarding(req, testUser);

        assertTrue(resp.isCompleted(), "Onboarding should be marked completed");
        assertFalse(resp.isSamvidhaConnected(), "Samvidha connection was skipped");
        assertEquals(4, resp.getSemester());
        assertEquals("Computer Science and Engineering (CSE)", resp.getBranch());
        assertEquals("B", resp.getSection());
        assertTrue(resp.getEnrolledCourses().contains("Data Structures"));
        assertTrue(resp.getDifficultSubjects().contains("Theory of Computation"));

        // Verify User state
        User updatedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertTrue(updatedUser.isOnboardingCompleted(), "User entity flag should be true");

        // Verify password audit: student_onboarding table never has password column
        StudentOnboarding ob = onboardingRepository.findByUser(testUser).orElseThrow();
        assertNotNull(ob.getId());
        assertEquals("DAILY_BRIEF", ob.getCheckInFrequency());
    }

    @Test
    void testOnboardingSurveyConnectPath() {
        OnboardingSurveyRequest req = OnboardingSurveyRequest.builder()
                .semester(4)
                .branch("Computer Science and Engineering (CSE)")
                .section("A")
                .connectSamvidha(false)
                .difficultSubjects(List.of("Computer Networks"))
                .build();

        OnboardingSurveyResponse resp = onboardingService.saveOnboarding(req, testUser);

        assertTrue(resp.isCompleted());
    }

    @Test
    void testChatMemoryServiceSessionPersistence() {
        // 1. Create or get session
        ChatSession session = chatMemoryService.getOrCreateSession(null, testUser, "What is the Library route?");
        assertNotNull(session.getId());
        assertEquals("What is the Library route?", session.getTitle());

        // 2. Save user message
        chatMemoryService.saveUserMessage(session, testUser, "What is the Library route?", "text");

        // 3. Save assistant message
        chatMemoryService.saveAssistantMessage(session, testUser, "The Central Library is located in Academic Block A.", "text", "navigation", "{\"success\":true}");

        // 4. Retrieve session with full message history
        ChatSessionDto sessionDto = chatMemoryService.getSessionWithMessages(session.getId(), testUser);
        assertEquals(2, sessionDto.getMessageCount());
        List<ChatMessageDto> msgs = sessionDto.getMessages();
        assertEquals("user", msgs.get(0).getRole());
        assertEquals("What is the Library route?", msgs.get(0).getContent());
        assertEquals("assistant", msgs.get(1).getRole());
        assertEquals("navigation", msgs.get(1).getAgentType());

        // 5. Test AI prompt conversation context compiler
        var aiContext = chatMemoryService.getConversationContextForAI(session);
        assertEquals(session.getId(), aiContext.get("session_id"));
        @SuppressWarnings("unchecked")
        List<Object> recent = (List<Object>) aiContext.get("recent_messages");
        assertEquals(2, recent.size());
    }

    @Test
    void testWeaknessServiceTopicTrackingAndDetection() {
        // Record 3 questions on "Binary Search Trees"
        weaknessService.recordTopicAsked(testUser, "Data Structures", "Binary Search Trees", "How to insert into a BST?");
        weaknessService.recordTopicAsked(testUser, "Data Structures", "Binary Search Trees", "What is AVL tree height balancing?");
        weaknessService.recordTopicAsked(testUser, "Data Structures", "Binary Search Trees", "Explain tree traversals");

        // Record 1 question on "Operating Systems"
        weaknessService.recordTopicAsked(testUser, "Operating Systems", "Virtual Memory", "What is page replacement?");

        // Also add self-reported weak subject
        onboardingService.saveOnboarding(
                OnboardingSurveyRequest.builder()
                        .difficultSubjects(List.of("Theory of Computation"))
                        .connectSamvidha(false)
                        .build(),
                testUser
        );

        List<String> weakTopics = weaknessService.getWeakTopicsForStudent(testUser);

        // Binary Search Trees recurs >= 3 times, Theory of Computation is self-reported
        assertTrue(weakTopics.contains("Binary Search Trees"), "Recurrent topic should be detected as weak area");
        assertTrue(weakTopics.contains("Theory of Computation"), "Self-reported difficult subject should be included");
        assertFalse(weakTopics.contains("Virtual Memory"), "Topic asked only once should NOT be considered weak");
    }

    @Test
    void testDefensiveSamvidhaFailureHandling() {
        OnboardingSurveyRequest req = OnboardingSurveyRequest.builder()
                .semester(4)
                .branch("Computer Science and Engineering (CSE)")
                .section("C")
                .connectSamvidha(true)
                .samvidhaRollNo("99999Z9999")
                .samvidhaPassword("invalid_bad_password_defensive")
                .build();

        OnboardingSurveyResponse resp = onboardingService.saveOnboarding(req, testUser);

        // Onboarding should still succeed with self-reported data even if live Samvidha fails
        assertTrue(resp.isCompleted(), "Onboarding should complete cleanly");
        assertFalse(resp.isSamvidhaConnected(), "Samvidha connection should be marked false");
        assertNotNull(resp.getSamvidhaError(), "Samvidha defensive error message should be set");
        assertTrue(resp.getSamvidhaError().contains("Couldn't connect to Samvidha right now") ||
                   resp.getSamvidhaError().contains("Invalid"), "Defensive error notice should be provided");
    }

    @Test
    void testPasswordNeverPersistedAudit() {
        String sensitiveSecret = "SuperSecretPlainTextPassword123!#";

        OnboardingSurveyRequest req = OnboardingSurveyRequest.builder()
                .semester(3)
                .branch("Information Technology (IT)")
                .connectSamvidha(true)
                .samvidhaRollNo("22951A1201")
                .samvidhaPassword(sensitiveSecret)
                .build();

        onboardingService.saveOnboarding(req, testUser);

        // Audit StudentOnboarding
        StudentOnboarding ob = onboardingRepository.findByUser(testUser).orElseThrow();
        assertFalse(ob.toString().contains(sensitiveSecret), "Onboarding entity or toString must never contain the plain password");

        // Audit OnboardingSurveyRequest toString
        assertFalse(req.toString().contains(sensitiveSecret), "Request DTO toString must exclude samvidhaPassword");
    }
}
