package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"samvidhaPassword"})
public class OnboardingSurveyRequest {
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
    private String checkInFrequency; // "DAILY_BRIEF", "WEEKLY", "CRITICAL_ONLY"
    @Builder.Default
    private Boolean moodCheckInsAllowed = true;

    // Optional Samvidha sync credentials
    private String samvidhaRollNo;
    private String samvidhaPassword;
    @Builder.Default
    private Boolean connectSamvidha = false;
}
