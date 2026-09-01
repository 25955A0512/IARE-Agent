package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Entity tracking topics asked by students for lightweight weakness detection.
 */
@Entity
@Table(name = "student_topics_asked")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentTopicAsked {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 150)
    private String subject;

    @Column(nullable = false, length = 150)
    private String topic;

    @Column(length = 500)
    private String queryText;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
