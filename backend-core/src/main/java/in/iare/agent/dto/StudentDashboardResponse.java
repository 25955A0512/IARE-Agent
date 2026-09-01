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
public class StudentDashboardResponse {

    private String rollNo;
    private String fullName;
    private String dob;
    private String profilePhotoUrl;
    private String gender;
    private String bloodGroup;
    private String email;
    private String department;
    private Integer yearOfStudy;
    private Integer semester;
    private String section;
    private Double overallAttendance;
    private String attendanceStatus; // GOOD, WARNING, CRITICAL
    private Integer safeBunksAvailable;
    private Integer classesNeededFor75;
    private Instant lastSyncedAt;

    private List<AttendanceDTO> attendance;
    private List<TimetableDTO> todaySchedule;
    private List<TimetableDTO> weeklySchedule;
    private List<MarksDTO> marks;
    private List<LabSubmissionDTO> labSubmissions;
    private List<NoticeDTO> notices;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttendanceDTO {
        private String subjectCode;
        private String subjectName;
        private Integer attendedClasses;
        private Integer totalClasses;
        private Double percentage;
        private String status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimetableDTO {
        private Integer dayOfWeek;
        private String timeSlotStart;
        private String timeSlotEnd;
        private String subjectCode;
        private String subjectName;
        private String room;
        private String facultyName;
        private Boolean isCurrent;
        private Boolean isNext;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MarksDTO {
        private String subjectCode;
        private String subjectName;
        private Double cie1;
        private Double cie2;
        private Double internalTotal;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LabSubmissionDTO {
        private String subjectCode;
        private String subjectName;
        private String experimentName;
        private String dueDate;
        private String status; // PENDING, SUBMITTED, EVALUATED
        private Double marksObtained;
        private Double maxMarks;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NoticeDTO {
        private String title;
        private String noticeDate;
        private String category;
        private String linkUrl;
        private String description;
    }
}
