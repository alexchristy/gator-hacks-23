// popup.js
// Get references to the input field and the send button
const IP = "http://10.167.0.100";
const port = ":5000";
var rootUrl;
var amountMessages = 0;
var path;

document.addEventListener('DOMContentLoaded', function () {
    const messageInput = document.getElementById('messageInput');
    const sendMessageButton = document.getElementById('sendMessageButton');
    const urlContainer = document.getElementById('urlContainer');
    startchat(urlContainer);
    
    // Add a click event listener to the send button
    sendMessageButton.addEventListener('click', function () {
        sendMessage();
    });

    // Add a key press event listener to the input field
    messageInput.addEventListener('keyup', function (event) {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
});

function showLoading() {
    const loadingContainer = document.createElement('div');
    const chatMessages = document.getElementById('chatMessages');
    loadngContainer.setAttribute('class', 'chattr-message-bubble');
    loadingContainer.setAttribute('id', 'loader');

    const loading = document.createElement('div');
    loading.classList.add('loading');

    for (let i = 0; i < 3; i++) {
        const loadingCircle = document.createElement('div');
        loadingCircle.classList.add('loading-circle');
        loading.appendChild(loadingCircle);
    }
    loadingContainer.appendChild(loading);
    chatMessages.append(loadingContainer);
}

function hideLoading() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.removeChild(chatMessages.lastElementChild);
}

function getRootUrl(urlContainer) {
    // Get the active tab's URL
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0];
            const url = currentTab.url;

            // Display the URL in your popup
            urlContainer.textContent = url;
            const parser = document.createElement('a');
            parser.href = urlContainer.textContent;

            // Combine the protocol, hostname, and port to get the root URL
            resolve(parser.protocol + '//' + parser.hostname);
        });        
    });
}

async function startchat(urlContainer) {
    getRootUrl(urlContainer).then(async(url) => {
        rootUrl = url;
        return loadMessages(rootUrl);})
	.then(async (messageCount) => {
        if (messageCount > 0)
        {
            console.log("welcome back");
            path = "/responses/welcome-back";
        }
        else
        {
            console.log("Hi");
            path = "/responses/greeting";
        }
	showLoading();
        fetch(IP+port+path, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => {
	    hideLoading();
            const readableStream = response.body;
            const textDecoder = new TextDecoder();
            const reader = readableStream.getReader();
    
            function readStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        console.log('Stream reading complete');
                        return;
                    }
    
                    const text = textDecoder.decode(value);
                    return text;
                });
            }
    
            return readStream();     
        }).then(async message => {
                await typeMessage(JSON.parse(message).message);
        })
    });
}

async function loadMessages(url) {
    return new Promise((resolve) => { 
	    chrome.storage.local.get(url, function(result) {
            const chatMessages = result[url] || [];
            displaySavedMessages(chatMessages);
            console.log(chatMessages.length);
            resolve(chatMessages.length);
            });
    });
}

// Function to simulate typing animation
function typeMessage(message) {
    return new Promise((resolve) => {
        let i = 0;
        const messageElement = document.createElement('div');
        const chatMessages = document.getElementById('chatMessages');
        messageElement.setAttribute('class', 'chattr-message-bubble');
        chatMessages.appendChild(messageElement);
        messageElement.textContent += "Chattr: ";
        function typeChar() {
            if (i < message.length) {
                messageElement.textContent += message.charAt(i);
                i++;
                setTimeout(typeChar, 30); // Adjust the delay (in milliseconds) between characters
            } else {
                saveMessage(rootUrl, messageElement.textContent);
                resolve(); // Resolve the promise when typing is complete
            }
        }

        typeChar();
    });
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (message !== '') {
      displayMessage('You', message); // Display the message immediately

        messageInput.value = ''; // Clear the input field
    }
}

// Function to display a message in the chat messages container and then save to local storage
function displayMessage(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.setAttribute('class', 'user-message-bubble');
    messageElement.textContent = sender + ': ' + message;
    chatMessages.appendChild(messageElement);
    saveMessage(rootUrl, messageElement.textContent);
}

// Function to load saved messages when popup is repopend
function displaySavedMessages(messages) {
    const chatDiv = document.getElementById('chatMessages');
    chatDiv.innerHTML = ''; // Clear existing messages

    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        if (message[0] == 'C') {
            messageElement.setAttribute('class', 'chattr-message-bubble');
        }
        else {
            messageElement.setAttribute('class', 'user-message-bubble');
        }
        chatDiv.appendChild(messageElement);
    });
}

function saveMessage(url, message) {
    chrome.storage.local.get(url, function(result) {
        const chatMessages = result[url] || [];
        chatMessages.push(message);

        const data = {};
        data[url] = chatMessages;

        chrome.storage.local.set(data, function() {
            console.log('Chat message saved to chrome.storage.local:', data);
        });
    });
}
