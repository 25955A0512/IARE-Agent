package in.iare.agent.repository;

import in.iare.agent.model.StudentMarks;
import in.iare.agent.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentMarksRepository extends JpaRepository<StudentMarks, Long> {
    List<StudentMarks> findByStudentProfile(StudentProfile studentProfile);
}
