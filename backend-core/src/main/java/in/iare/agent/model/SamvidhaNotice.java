package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "samvidha_notices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SamvidhaNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 50)
    private String noticeDate;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String category = "ACADEMIC"; // PLACEMENT, EXAMINATION, ACADEMIC, CIRCULAR

    @Column(length = 500)
    private String linkUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
