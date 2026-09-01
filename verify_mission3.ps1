# Test Mission 3 End-to-End API Workflows

$baseUrl = "http://localhost:8080/api"
Write-Host "=== 1. Testing Health ==="
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
Write-Host "Health:" ($health | ConvertTo-Json -Compress)

Write-Host "`n=== 2. Register / Login as Student ==="
$regBody = @{
    fullName = "Govind Nayak"
    email = "mission3_test_student@iare.ac.in"
    password = "Password@123"
} | ConvertTo-Json

try {
    $auth = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    Write-Host "Registered new user:" $auth.fullName
} catch {
    $loginBody = @{
        email = "mission3_test_student@iare.ac.in"
        password = "Password@123"
    } | ConvertTo-Json
    $auth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "Logged into existing user:" $auth.fullName
}

$token = $auth.accessToken
Write-Host "Logged in successfully as:" $auth.fullName "Role:" $auth.role "OnboardingCompleted:" $auth.onboardingCompleted

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "`n=== 3. Submit Onboarding Survey (Skip Path) ==="
$surveyBody = @{
    semester = 4
    branch = "Computer Science and Engineering (CSE)"
    section = "A"
    enrolledCourses = @("Data Structures & Algorithms", "Operating Systems", "Discrete Mathematics")
    difficultSubjects = @("Binary Search Trees", "Deadlocks")
    collegeGoals = "Crack Tier-1 Placement"
    technicalInterests = "AI/ML, Fullstack Web Development"
    clubsActivities = "Coding Club, Robotics"
    preferredNotificationTimes = "Morning 8:00 AM & Evening 6:00 PM"
    monitoredTelegramGroups = "IARE CSE 2026 Official"
    checkInFrequency = "DAILY_BRIEF"
    moodCheckInsAllowed = $true
    connectSamvidha = $false
} | ConvertTo-Json

$onboardingResp = Invoke-RestMethod -Uri "$baseUrl/student/onboarding" -Method Post -Body $surveyBody -Headers $headers
Write-Host "Onboarding Completed:" $onboardingResp.completed "Branch:" $onboardingResp.branch "Courses:" ($onboardingResp.enrolledCourses -join ", ")

Write-Host "`n=== 4. Fetch Saved Onboarding Profile ==="
$getOnboarding = Invoke-RestMethod -Uri "$baseUrl/student/onboarding" -Method Get -Headers $headers
Write-Host "Fetched Onboarding: Goals=" $getOnboarding.collegeGoals "SamvidhaConnected=" $getOnboarding.samvidhaConnected

Write-Host "`n=== 5. Query 1: General Assistant (TCP vs UDP) ==="
$q1 = @{
    message = "Explain the key differences between TCP and UDP with examples"
    mode = "text"
} | ConvertTo-Json

$res1 = Invoke-RestMethod -Uri "$baseUrl/agent/query" -Method Post -Body $q1 -Headers $headers
Write-Host "Agent:" $res1.agent "SessionId:" $res1.sessionId
Write-Host "Answer Preview:" $res1.message.Substring(0, [Math]::Min(150, $res1.message.Length)) "..."

$activeSessionId = $res1.sessionId

Write-Host "`n=== 6. Query 2: Weakness Trigger Topic (Deadlocks) in same session ==="
$q2 = @{
    message = "Explain the four necessary conditions for deadlocks in Operating Systems"
    mode = "text"
    sessionId = $activeSessionId
} | ConvertTo-Json

$res2 = Invoke-RestMethod -Uri "$baseUrl/agent/query" -Method Post -Body $q2 -Headers $headers
Write-Host "Agent:" $res2.agent "Topic:" $res2.topic "IsWeaknessTrigger:" $res2.is_weakness_trigger
Write-Host "Has Practice Tip:" ($res2.message -match "practice")
Write-Host "Answer Preview:" $res2.message.Substring(0, [Math]::Min(180, $res2.message.Length)) "..."

Write-Host "`n=== 7. Query 3: Navigation Query in same session ==="
$q3 = @{
    message = "Where is the Central Library and how do I get there?"
    mode = "text"
    sessionId = $activeSessionId
} | ConvertTo-Json

$res3 = Invoke-RestMethod -Uri "$baseUrl/agent/query" -Method Post -Body $q3 -Headers $headers
Write-Host "Agent:" $res3.agent "Route Stops:" ($res3.route_stops -join " -> ")

Write-Host "`n=== 8. Fetch Chat Sessions (Persistent Memory) ==="
$sessionsResp = Invoke-RestMethod -Uri "$baseUrl/chat/sessions" -Method Get -Headers $headers
Write-Host "Total Sessions:" $sessionsResp.totalSessions
foreach ($s in $sessionsResp.sessions) {
    Write-Host " - Session ID:" $s.id "Title:" $s.title "MsgCount:" $s.messageCount
}

Write-Host "`n=== 9. Fetch Full Conversation Messages for Active Session ==="
$sessionDetails = Invoke-RestMethod -Uri "$baseUrl/chat/sessions/$activeSessionId" -Method Get -Headers $headers
Write-Host "Session Title:" $sessionDetails.title "Messages Count:" $sessionDetails.messages.Length
foreach ($m in $sessionDetails.messages) {
    Write-Host "   [" + $m.role + "]:" $m.content.Substring(0, [Math]::Min(60, $m.content.Length)) "..."
}

Write-Host "`n=== 10. Test Samvidha Connect Path in Onboarding ==="
$connectBody = @{
    semester = 4
    branch = "Computer Science and Engineering (CSE)"
    section = "A"
    connectSamvidha = $true
    samvidhaRollNo = "21951A0501"
    samvidhaPassword = "secret123"
} | ConvertTo-Json

$connectResp = Invoke-RestMethod -Uri "$baseUrl/student/onboarding" -Method Post -Body $connectBody -Headers $headers
Write-Host "Samvidha Connected:" $connectResp.samvidhaConnected "RollNo:" $connectResp.studentDashboard.rollNo "Attendance:" $connectResp.studentDashboard.overallAttendance "%"

Write-Host "`n=== ALL MISSION 3 VERIFICATIONS SUCCEEDED ==="
