package in.iare.agent.repository;

import in.iare.agent.model.Event;
import in.iare.agent.model.StudentEventNotification;
import in.iare.agent.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentEventNotificationRepository extends JpaRepository<StudentEventNotification, Long> {

    List<StudentEventNotification> findByUserAndReadFalseOrderByCreatedAtDesc(User user);

    List<StudentEventNotification> findByUserOrderByCreatedAtDesc(User user);

    Optional<StudentEventNotification> findByUserAndEventAndNotificationType(User user, Event event, String notificationType);

    long countByUserAndReadFalse(User user);
}
