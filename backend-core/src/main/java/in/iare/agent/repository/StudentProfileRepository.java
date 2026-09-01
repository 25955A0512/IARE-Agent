package in.iare.agent.repository;

import in.iare.agent.model.StudentProfile;
import in.iare.agent.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {
    Optional<StudentProfile> findByRollNo(String rollNo);
    Optional<StudentProfile> findByUser(User user);
    boolean existsByRollNo(String rollNo);
}
