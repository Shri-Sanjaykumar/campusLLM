import requests

BASE_URL = 'https://sanjay326-campusllm.hf.space'

# Get Token
resp = requests.post(f'{BASE_URL}/token', data={'username': 'vit_data_bot', 'password': 'securepassword123'})
token = resp.json().get('access_token')

headers = {'Authorization': f'Bearer {token}'}

# Test Q1
q1 = 'What is the S grade policy in relative grading?'
print(f'Q: {q1}')
res1 = requests.post(f'{BASE_URL}/ask', headers=headers, json={'question': q1})
print(f'A: {res1.json().get("answer")}\n')

# Test Q2
q2 = 'How do I apply for proctor leave?'
print(f'Q: {q2}')
res2 = requests.post(f'{BASE_URL}/ask', headers=headers, json={'question': q2})
print(f'A: {res2.json().get("answer")}\n')

# Test Q3
q3 = 'What is the capital of Japan?'
print(f'Q: {q3}')
res3 = requests.post(f'{BASE_URL}/ask', headers=headers, json={'question': q3})
print(f'A: {res3.json().get("answer")}\n')

