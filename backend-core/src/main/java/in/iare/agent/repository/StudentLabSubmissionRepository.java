package in.iare.agent.repository;

import in.iare.agent.model.StudentLabSubmission;
import in.iare.agent.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentLabSubmissionRepository extends JpaRepository<StudentLabSubmission, Long> {
    List<StudentLabSubmission> findByStudentProfileOrderByDueDateAsc(StudentProfile profile);
}
