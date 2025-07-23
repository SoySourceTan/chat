export function createOnlineUsersList(users) {
 const onlineUsersList = document.createElement('div');
  onlineUsersList.className = 'online-users-list';
  onlineUsersList.innerHTML = '<h5>オンラインユーザー</h5>';

  const userList = document.createElement('ul');
  userList.className = 'list-unstyled';
  for (const userId in users) {
    const user = users[userId];
    const li = document.createElement('li');
    li.textContent = user.username;
   userList.appendChild(li);
  }
  onlineUsersList.appendChild(userList);
  return onlineUsersList;
}


export function renderOnlineUsers() {}