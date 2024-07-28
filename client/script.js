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
        sendData(exampleData);
    } else {
        alert('Please log in first');
        window.location.href = 'https://phone-tracking-v2.onrender.com/auth/google';
    }
}).catch(error => {
    console.error('Error checking authentication:', error);
});
