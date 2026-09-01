package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "student_lab_submissions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentLabSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Column(nullable = false, length = 20)
    private String subjectCode;

    @Column(nullable = false, length = 150)
    private String subjectName;

    @Column(nullable = false, length = 200)
    private String experimentName;

    @Column(nullable = false, length = 30)
    private String dueDate;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING"; // PENDING, SUBMITTED, EVALUATED

    private Double marksObtained;

    @Builder.Default
    private Double maxMarks = 10.0;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
