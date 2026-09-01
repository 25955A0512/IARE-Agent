package in.iare.agent.repository;

import in.iare.agent.model.ChatSession;
import in.iare.agent.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, String> {
    List<ChatSession> findByUserOrderByUpdatedAtDesc(User user);
    Optional<ChatSession> findByIdAndUser(String id, User user);
}
