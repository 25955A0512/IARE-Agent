package in.iare.agent.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entity representing a timetable slot for a student.
 */
@Entity
@Table(name = "student_timetables")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentTimetable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id", nullable = false)
    @JsonIgnore
    private StudentProfile studentProfile;

    /** 0 = Monday ... 5 = Saturday */
    @Column(nullable = false)
    private Integer dayOfWeek;

    /** 24-hour clock string, e.g. "09:00" */
    @Column(nullable = false, length = 5)
    private String timeSlotStart;

    /** 24-hour clock string, e.g. "09:50" */
    @Column(nullable = false, length = 5)
    private String timeSlotEnd;

    @Column(length = 30)
    private String subjectCode;

    @Column(nullable = false, length = 150)
    private String subjectName;

    @Column(nullable = false, length = 80)
    private String room;

    @Column(length = 120)
    private String facultyName;
}
