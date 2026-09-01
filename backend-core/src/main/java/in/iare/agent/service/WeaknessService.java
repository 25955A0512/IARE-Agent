package in.iare.agent.service;

import in.iare.agent.model.StudentOnboarding;
import in.iare.agent.model.StudentTopicAsked;
import in.iare.agent.model.User;
import in.iare.agent.repository.StudentOnboardingRepository;
import in.iare.agent.repository.StudentTopicAskedRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Service for lightweight, privacy-preserving weakness detection.
 *
 * Rules (per prompt & AGENTS.md):
 * - Tracks topics asked in General Assistant Q&A in `student_topics_asked`.
 * - If a topic recurs 3+ times within 7 days OR matches a self-reported weak subject, treat as weak area.
 * - Private to the student only. No external report or diagnosis.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WeaknessService {

    private final StudentTopicAskedRepository topicAskedRepository;
    private final StudentOnboardingRepository onboardingRepository;

    @Transactional
    public void recordTopicAsked(User user, String subject, String topic, String queryText) {
        if (user == null || topic == null || topic.isBlank()) {
            return;
        }

        String safeSubject = (subject != null && !subject.isBlank()) ? subject.trim() : "General";
        String safeTopic = topic.trim();
        String safeQuery = (queryText != null && queryText.length() > 500) ? queryText.substring(0, 500) : queryText;

        StudentTopicAsked record = StudentTopicAsked.builder()
                .user(user)
                .subject(safeSubject)
                .topic(safeTopic)
                .queryText(safeQuery)
                .build();

        topicAskedRepository.save(record);
        log.debug("Recorded topic for user {}: {} -> {}", user.getId(), safeSubject, safeTopic);
    }

    @Transactional(readOnly = true)
    public List<String> getWeakTopicsForStudent(User user) {
        if (user == null) {
            return Collections.emptyList();
        }

        Set<String> weakTopics = new LinkedHashSet<>();

        // 1. Recurring topics asked >= 3 times in the past 7 days
        Instant sevenDaysAgo = Instant.now().minus(Duration.ofDays(7));
        List<Object[]> recurring = topicAskedRepository.findRecurringTopics(user, sevenDaysAgo, 3L);
        for (Object[] row : recurring) {
            if (row != null && row.length > 0 && row[0] != null) {
                weakTopics.add(row[0].toString().trim());
            }
        }

        // 2. Self-reported difficult subjects from Onboarding Survey
        onboardingRepository.findByUser(user).ifPresent(survey -> {
            if (survey.getDifficultSubjects() != null && !survey.getDifficultSubjects().isBlank()) {
                String[] subs = survey.getDifficultSubjects().split("[,;\\n]+");
                for (String s : subs) {
                    String clean = s.trim();
                    if (!clean.isEmpty()) {
                        weakTopics.add(clean);
                    }
                }
            }
        });

        return new ArrayList<>(weakTopics);
    }
}
