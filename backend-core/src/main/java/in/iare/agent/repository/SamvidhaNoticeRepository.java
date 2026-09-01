package in.iare.agent.repository;

import in.iare.agent.model.SamvidhaNotice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SamvidhaNoticeRepository extends JpaRepository<SamvidhaNotice, Long> {
    List<SamvidhaNotice> findAllByOrderByCreatedAtDesc();
    List<SamvidhaNotice> findByCategoryOrderByCreatedAtDesc(String category);
}
