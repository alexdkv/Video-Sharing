
window.addEventListener('DOMContentLoaded', () => {
    const userName = document.body.dataset.username + Math.floor(Math.random() * 100000);
    const password = "x";
    document.querySelector('#user-name').innerHTML = userName;

    const socket = io.connect('https://192.168.0.151:8181/', {
        auth: { userName, password }
    });

    const localVideoEl = document.querySelector('#local-video');
    const remoteVideoEl = document.querySelector('#remote-video');
    let localStream, remoteStream, peerConnection;

    const peerConfiguration = {
        iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
    };

    socket.on('availableOffers', createOfferEls);
    socket.on('newOfferAwaiting', createOfferEls);
    socket.on('receivedIceCandidateFromServer', iceCandidate => {
        peerConnection?.addIceCandidate(iceCandidate);
    });

    async function answerOffer(offerObj) {
        await fetchUserMedia();
        await createPeerConnection(offerObj);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        offerObj.answer = answer;
        offerObj.answererUserName = userName;

        const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
        offerIceCandidates.forEach(c => peerConnection.addIceCandidate(c));
    }

    async function fetchUserMedia() {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true });
        localVideoEl.srcObject = localStream;
    }

    async function createPeerConnection(offerObj) {
        peerConnection = new RTCPeerConnection(peerConfiguration);
        remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = e => {
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer: false
                });
            }
        };

        peerConnection.ontrack = e => {
            e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        };

        await peerConnection.setRemoteDescription(offerObj.offer);
    }

    function createOfferEls(offers) {
        const answerEl = document.querySelector('#answer');
        answerEl.innerHTML = ''; // Clear previous offers
        offers.forEach(o => {
            const btn = document.createElement('button');
            btn.className = "btn btn-success col-1";
            btn.textContent = `Answer ${o.offererUserName}`;
            btn.onclick = () => answerOffer(o);
            answerEl.appendChild(btn);
        });
    }
});
