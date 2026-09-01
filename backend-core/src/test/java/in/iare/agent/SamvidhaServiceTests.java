package in.iare.agent;

import in.iare.agent.service.SamvidhaService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SamvidhaServiceTests {

    @Test
    void testExtractStudentNameFromSamvidhaRightCornerHtml() {
        // Pattern 1: AdminLTE top right navbar-custom-menu user menu
        String adminLteHtml = """
            <header class="main-header">
                <nav class="navbar navbar-static-top">
                    <div class="navbar-custom-menu">
                        <ul class="nav navbar-nav">
                            <li class="dropdown user user-menu">
                                <a href="#" class="dropdown-toggle" data-toggle="dropdown">
                                    <img src="uploads/avatar.jpg" class="user-image" alt="User Image">
                                    <span class="hidden-xs">GOVIND NAYAK</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </nav>
            </header>
        """;
        String name1 = SamvidhaService.extractStudentNameFromSamvidha(adminLteHtml, "21951A0501");
        assertEquals("Govind Nayak", name1);

        // Pattern 2: Right corner user-header dropdown widget
        String userHeaderHtml = """
            <li class="dropdown user user-menu">
                <ul class="dropdown-menu">
                    <li class="user-header">
                        <p>
                            RAHUL SHARMA - CSE
                            <small>21951A0502</small>
                        </p>
                    </li>
                </ul>
            </li>
        """;
        String name2 = SamvidhaService.extractStudentNameFromSamvidha(userHeaderHtml, "21951A0502");
        assertEquals("Rahul Sharma", name2);

        // Pattern 3: Right corner Welcome banner
        String welcomeHtml = """
            <div class="top-nav-right pull-right">
                <span>Welcome, <b>ANANYA REDDY (21951A0503)</b></span>
            </div>
        """;
        String name3 = SamvidhaService.extractStudentNameFromSamvidha(welcomeHtml, "21951A0503");
        assertEquals("Ananya Reddy", name3);

        // Pattern 4: Top right element with lblStudentName id
        String idHtml = """
            <div class="navbar-right">
                <span id="lblStudentName">Karthik Varma</span>
            </div>
        """;
        String name4 = SamvidhaService.extractStudentNameFromSamvidha(idHtml, "21951A0504");
        assertEquals("Karthik Varma", name4);
    }

    @Test
    void testExtractPhotoUrl() {
        String htmlWithPhoto = """
            <div class="user-panel">
                <img src="uploads/student_photos/21951A0501.jpg" alt="Student Photo" />
            </div>
        """;
        String photoUrl = SamvidhaService.extractPhotoUrlFromSamvidha(htmlWithPhoto);
        assertNotNull(photoUrl);
        assertTrue(photoUrl.contains("21951A0501.jpg"));
    }

    @Test
    void testCleanExtractedName() {
        String clean1 = SamvidhaService.cleanExtractedName("Welcome: Govind Nayak (21951A0501)", "21951A0501");
        assertEquals("Govind Nayak", clean1);

        String clean2 = SamvidhaService.cleanExtractedName("Student - Rahul Sharma", "21951A0502");
        assertEquals("Rahul Sharma", clean2);
    }
}
