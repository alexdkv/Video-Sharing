window.addEventListener('DOMContentLoaded', async () => {
    const userName = document.body.dataset.username + Math.floor(Math.random() * 100000);
    const password = "x";
    document.querySelector('#user-name').innerHTML = userName;

    const socket = io.connect(
        //'https://192.168.0.151:8181/', 
        'https://172.20.10.3:8181/',
        {
        auth: { userName, password }
    });

    const localVideoEl = document.querySelector('#local-video');
    const remoteVideoEl = document.querySelector('#remote-video');
    let localStream, remoteStream, peerConnection;
    let didIOffer = false;

    const peerConfiguration = {
        iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
    };

    document.querySelector('#call').addEventListener('click', call);

    socket.on('answerResponse', offerObj => {
        addAnswer(offerObj);
    });

    socket.on('receivedIceCandidateFromServer', iceCandidate => {
        peerConnection?.addIceCandidate(iceCandidate);
    });

    async function call() {
        await fetchUserMedia();
        await createPeerConnection();
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            didIOffer = true;
            socket.emit('newOffer', offer);
        } catch (err) {
            console.error(err);
        }
    }

    async function fetchUserMedia() {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true });
        localVideoEl.srcObject = localStream;
    }

    async function createPeerConnection() {
        peerConnection = new RTCPeerConnection(peerConfiguration);
        remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = e => {
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer
                });
            }
        };

        peerConnection.ontrack = e => {
            e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        };
    }

    async function addAnswer(offerObj) {
        await peerConnection.setRemoteDescription(offerObj.answer);
    }
});
