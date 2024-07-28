// Import the Socket.IO client
const socket = io('https://phone-tracking-v2.onrender.com');

// Function to send data
function sendData(data) {
    fetch('https://phone-tracking-v2.onrender.com/send-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies (session ID)
        body: JSON.stringify(data)
    }).then(response => {
        if (response.ok) {
            console.log('Data sent successfully');
        } else if (response.status === 401) {
            console.error('Unauthorized: Please log in first');
            alert('Please log in first');
            window.location.href = 'https://phone-tracking-v2.onrender.com/auth/google';
        } else {
            console.error('Failed to send data');
        }
    }).catch(error => {
        console.error('Error:', error);
    });
}

// Example of sending sensor data after authentication
const exampleData = { rotation: { alpha: 30, beta: 45, gamma: 60 } };

// Check if the user is authenticated before sending data
fetch('https://phone-tracking-v2.onrender.com/profile', {
    credentials: 'include'
}).then(response => {
    if (response.ok) {
        return response.json(); // Parse the response to get the user profile
    } else {
        alert('Please log in first');
        window.location.href = 'https://phone-tracking-v2.onrender.com/auth/google';
    }
}).then(userProfile => {
    const userId = userProfile.id; // Get the user ID from the profile
    socket.emit('join', userId); // Join the Socket.IO room with the user ID
    sendData(exampleData);
}).catch(error => {
    console.error('Error checking authentication:', error);
});

// Handle incoming messages
socket.on('message', (message) => {
    console.log('Message from server:', message);
    alert(message); // Display the message to the user
    const messageDiv = document.getElementById('messages');
    const newMessage = document.createElement('div');
    newMessage.textContent = message;
    messageDiv.appendChild(newMessage);
});
