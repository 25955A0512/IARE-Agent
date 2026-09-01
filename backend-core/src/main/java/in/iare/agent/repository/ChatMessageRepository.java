package in.iare.agent.repository;

import in.iare.agent.model.ChatMessage;
import in.iare.agent.model.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findBySessionOrderByCreatedAtAsc(ChatSession session);
    List<ChatMessage> findBySessionIdOrderByCreatedAtAsc(String sessionId);
    long countBySession(ChatSession session);
}
