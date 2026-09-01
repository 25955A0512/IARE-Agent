package in.iare.agent.repository;

import in.iare.agent.model.StudentProfile;
import in.iare.agent.model.StudentTimetable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StudentTimetableRepository extends JpaRepository<StudentTimetable, Long> {
    List<StudentTimetable> findByStudentProfileOrderByDayOfWeekAscTimeSlotStartAsc(StudentProfile studentProfile);
    List<StudentTimetable> findByStudentProfileAndDayOfWeekOrderByTimeSlotStartAsc(StudentProfile studentProfile, Integer dayOfWeek);
}
