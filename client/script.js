function sendData(data) {
    fetch('http://https://phone-tracking.onrender.com/send-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies (session ID)
        body: JSON.stringify(data)
    }).then(response => {
        if (response.ok) {
            console.log('Data sent successfully');
        } else {
            console.error('Failed to send data');
        }
    });
}

// Example of sending sensor data
const exampleData = { rotation: { alpha: 30, beta: 45, gamma: 60 } };
sendData(exampleData);
