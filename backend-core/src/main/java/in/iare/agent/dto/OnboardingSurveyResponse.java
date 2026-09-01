package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OnboardingSurveyResponse {
    private boolean completed;
    private Integer semester;
    private String branch;
    private String section;
    private List<String> enrolledCourses;
    private List<String> difficultSubjects;
    private String collegeGoals;
    private String technicalInterests;
    private String clubsActivities;
    private String preferredNotificationTimes;
    private String monitoredTelegramGroups;
    private String checkInFrequency;
    private boolean moodCheckInsAllowed;
    private boolean samvidhaConnected;
    private String samvidhaError;
    private Instant completedAt;
    private Instant updatedAt;
    private StudentDashboardResponse studentDashboard;
}
