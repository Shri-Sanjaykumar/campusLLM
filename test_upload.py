import requests
import json
import os

BASE_URL = 'https://sanjay326-campusllm.hf.space'

# 1. Register Admin
print('Registering admin...')
try:
    requests.post(f'{BASE_URL}/register_admin', json={'username': 'vit_data_bot', 'password': 'securepassword123'})
except Exception as e:
    pass # might already exist

# 2. Get Token
print('Getting token...')
resp = requests.post(f'{BASE_URL}/token', data={'username': 'vit_data_bot', 'password': 'securepassword123'})
token = resp.json().get('access_token')

if not token:
    print('Failed to get token:', resp.text)
    exit(1)

headers = {'Authorization': f'Bearer {token}'}

# 3. Create Knowledge Files
knowledge = {
    'vit_relative_grading.txt': '''VIT Vellore Relative Grading System:
The relative grading system at VIT is designed to evaluate a student's performance relative to the class. 
Instead of fixed pass marks, grades are awarded based on a normal distribution curve (bell curve) of the class scores.
- 'S' Grade: Outstanding (>= 90 marks usually, but depends on the class average and standard deviation. Typically top 5-10% of the class).
- 'A' Grade: Excellent.
- 'B' Grade: Good.
- 'C', 'D', 'E' Grades: Average to below average.
- 'F' Grade: Fail.
- 'N' Grade: Debarred due to low attendance (minimum 75% required).
The class average usually forms the midpoint (C or B grade depending on the curve), and standard deviations dictate the cutoffs for higher and lower grades.''',

    'vit_ffcs_rules.txt': '''Fully Flexible Credit System (FFCS) at VIT:
FFCS allows students to tailor their academic schedule and coursework.
Key features:
- Faculty Selection: Students can choose the faculty they want for a specific course based on availability.
- Timing Selection: Students can select morning or evening theory/lab slots to design their own timetable.
- Course Choice: Students can register for University Core, Program Core, Program Electives, and University Electives.
- Add/Drop: During the Add/Drop phase, students can modify their registered courses.
Prerequisites must be met before registering for advanced courses. Minimum credits per semester is usually 16, maximum is 27.''',

    'vit_proctor_leave.txt': '''VIT Proctor Leave System:
Every student is assigned a faculty member as a Proctor who acts as a local guardian and academic guide.
- Leave Types: Home leave, Outing, Medical leave, and OD (On Duty) for events.
- Process: Students must apply for leave through VTOP.
- Approval: The leave must be approved by the Proctor, and for longer leaves or home leaves, an OTP/approval is often required from the parents.
- Timing: Outings are strictly timed, and students must return to the hostel by the stipulated curfew (usually 8:30 PM or 9:00 PM depending on the hostel block and gender).''',

    'vit_events_clubs.txt': '''Clubs, Chapters, and Cultural Events at VIT Vellore:
VIT boasts over 120 clubs and student chapters.
Major Cultural Events:
1. Riviera: The international sports and cultural fest of VIT, held annually around February. It spans 4 days and includes pro-shows, sports tournaments, and literary events.
2. graVITas: The annual techno-management fest focusing on hackathons, engineering competitions, and workshops.
Students register for these events using the VTOP portal or specific event portals.''',
}

# 4. Upload Files
for filename, content in knowledge.items():
    with open(filename, 'w') as f:
        f.write(content)
    
    print(f'Uploading {filename}...')
    with open(filename, 'rb') as f:
        files = {'file': (filename, f, 'text/plain')}
        res = requests.post(f'{BASE_URL}/upload', headers=headers, files=files)
        print(res.json())

# 5. Upload URLs
urls = [
    'https://vit.ac.in/about-vit',
    'https://vit.ac.in/academics/ffcs',
]

for url in urls:
    print(f'Uploading URL {url}...')
    res = requests.post(f'{BASE_URL}/upload-url', headers=headers, json={'url': url})
    print(res.json())

