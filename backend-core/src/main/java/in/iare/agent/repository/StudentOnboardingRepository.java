package in.iare.agent.repository;

import in.iare.agent.model.StudentOnboarding;
import in.iare.agent.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudentOnboardingRepository extends JpaRepository<StudentOnboarding, Long> {
    Optional<StudentOnboarding> findByUser(User user);
    Optional<StudentOnboarding> findByUserId(Long userId);
    boolean existsByUser(User user);
}
