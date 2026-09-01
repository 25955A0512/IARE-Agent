package in.iare.agent.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Entity representing subject-wise attendance for a student.
 */
@Entity
@Table(name = "student_attendance")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentAttendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id", nullable = false)
    @JsonIgnore
    private StudentProfile studentProfile;

    @Column(nullable = false, length = 30)
    private String subjectCode;

    @Column(nullable = false, length = 150)
    private String subjectName;

    @Column(nullable = false)
    @Builder.Default
    private Integer attendedClasses = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalClasses = 0;

    @Column(nullable = false)
    @Builder.Default
    private Double percentage = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
