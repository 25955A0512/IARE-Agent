package in.iare.agent.repository;

import in.iare.agent.model.StudentTopicAsked;
import in.iare.agent.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface StudentTopicAskedRepository extends JpaRepository<StudentTopicAsked, Long> {
    List<StudentTopicAsked> findByUserOrderByCreatedAtDesc(User user);

    @Query("SELECT t.topic, COUNT(t) FROM StudentTopicAsked t WHERE t.user = :user AND t.createdAt >= :since GROUP BY t.topic HAVING COUNT(t) >= :minCount")
    List<Object[]> findRecurringTopics(
            @Param("user") User user,
            @Param("since") Instant since,
            @Param("minCount") long minCount
    );
}
