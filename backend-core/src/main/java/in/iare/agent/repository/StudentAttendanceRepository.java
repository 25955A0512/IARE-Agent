package in.iare.agent.repository;

import in.iare.agent.model.StudentAttendance;
import in.iare.agent.model.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentAttendanceRepository extends JpaRepository<StudentAttendance, Long> {
    List<StudentAttendance> findByStudentProfile(StudentProfile studentProfile);
}
