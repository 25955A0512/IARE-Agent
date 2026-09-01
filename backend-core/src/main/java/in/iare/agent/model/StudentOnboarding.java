package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Entity representing student onboarding survey preferences and academic baseline.
 */
@Entity
@Table(name = "student_onboarding")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentOnboarding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    private Integer semester;

    @Column(length = 100)
    private String branch;

    @Column(length = 20)
    private String section;

    @Column(length = 1000)
    private String enrolledCourses;

    @Column(length = 1000)
    private String difficultSubjects;

    @Column(length = 500)
    private String collegeGoals;

    @Column(length = 500)
    private String technicalInterests;

    @Column(length = 500)
    private String clubsActivities;

    @Column(length = 200)
    private String preferredNotificationTimes;

    @Column(length = 500)
    private String monitoredTelegramGroups;

    @Column(length = 50)
    @Builder.Default
    private String checkInFrequency = "DAILY_BRIEF";

    @Column(nullable = false)
    @Builder.Default
    private Boolean moodCheckInsAllowed = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean samvidhaConnected = false;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant completedAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
