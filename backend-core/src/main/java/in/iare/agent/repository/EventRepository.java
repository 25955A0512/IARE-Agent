package in.iare.agent.repository;

import in.iare.agent.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {

    Optional<Event> findBySourceTelegramGroupIdAndSourceTelegramMessageId(Long groupId, Long messageId);

    List<Event> findAllByOrderByCreatedAtDesc();

    List<Event> findByMandatoryTrueOrderByCreatedAtDesc();

    @Query("SELECT e FROM Event e WHERE " +
           "(:semester IS NULL OR e.targetSemester IS NULL OR e.targetSemester = :semester) AND " +
           "(:branch IS NULL OR e.targetBranch IS NULL OR LOWER(e.targetBranch) = LOWER(:branch) OR LOWER(:branch) LIKE LOWER(CONCAT('%', e.targetBranch, '%'))) " +
           "ORDER BY e.createdAt DESC")
    List<Event> findEventsForStudentCohort(
            @Param("semester") Integer semester,
            @Param("branch") String branch
    );
}
