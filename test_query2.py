import requests

BASE_URL = 'https://sanjay326-campusllm.hf.space'

# Get Token
resp = requests.post(f'{BASE_URL}/token', data={'username': 'vit_data_bot', 'password': 'securepassword123'})
token = resp.json().get('access_token')

headers = {'Authorization': f'Bearer {token}'}

q1 = 'What is the S grade policy in relative grading?'
res1 = requests.post(f'{BASE_URL}/ask', headers=headers, json={'question': q1})
print(res1.status_code)
print(res1.text)

