package in.iare.agent.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Entity representing Continuous Internal Evaluation (CIE) marks.
 */
@Entity
@Table(name = "student_marks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentMarks {

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

    @Column
    private Double cie1;

    @Column
    private Double cie2;

    @Column
    private Double internalTotal;

    @Column(nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
