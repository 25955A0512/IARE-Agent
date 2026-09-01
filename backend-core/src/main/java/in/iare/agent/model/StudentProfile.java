package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity representing a student's profile synchronized from Samvidha.
 * Stores academic metadata, mentor info, and overall attendance.
 */
@Entity
@Table(name = "student_profiles",
       uniqueConstraints = @UniqueConstraint(columnNames = "roll_no"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, unique = true, length = 20)
    private String rollNo;

    @Column(nullable = false, length = 120)
    private String fullName;

    @Column(length = 80)
    private String department;

    private Integer yearOfStudy;

    private Integer semester;

    @Column(length = 10)
    private String section;

    @Column(length = 30)
    private String dob;

    @Column(length = 500)
    private String profilePhotoUrl;

    @Column(length = 20)
    private String gender;

    @Column(length = 10)
    private String bloodGroup;

    @Column(length = 255)
    private String email;

    @Column(length = 120)
    private String mentorName;

    @Column(length = 100)
    private String mentorCabin;

    @Column(length = 255)
    private String mentorEmail;

    @Column
    @Builder.Default
    private Double overallAttendance = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean consentGiven = true;

    @Column(nullable = false)
    @Builder.Default
    private Instant lastSyncedAt = Instant.now();

    @OneToMany(mappedBy = "studentProfile", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudentAttendance> attendanceRecords = new ArrayList<>();

    @OneToMany(mappedBy = "studentProfile", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudentTimetable> timetableSlots = new ArrayList<>();

    @OneToMany(mappedBy = "studentProfile", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudentMarks> marksRecords = new ArrayList<>();

    @OneToMany(mappedBy = "studentProfile", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudentLabSubmission> labSubmissions = new ArrayList<>();
}
