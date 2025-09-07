
const fs = require('fs');
const https = require('https')
const express = require('express');
const app = express();
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
//const verifyToken = require('./verifyToken');


app.set('view engine', 'ejs');
app.set('views','./views');
app.use(cookieParser());
/*
app.get(['/socket.io/socket.io.js', '//socket.io/socket.io.js'], (req, res) => {
    res.sendFile(__dirname + '/node_modules/socket.io-client/dist/socket.io.js');
});
*/
app.use((req, res, next) => {
    //console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/', verifyToken, (req, res) => {
    res.render('index', {userName: req.userName});
    //res.sendFile(__dirname + '/views/index.ejs');
});

app.get('/live', verifyToken, (req, res) => {
    res.render('index', {userName: req.userName});
    //res.sendFile(__dirname + '/views/index.ejs');
});

app.get('/', verifyToken, (req, res) =>{
    res.json({userName: req.userName});
    res.render('index', {userName});
});

app.get('/caller.ejs', verifyToken, (req, res) => {
    res.render('caller', {userName: req.userName});
    //res.sendFile(__dirname + '/views/index.ejs');
});

app.get('/receiver.ejs', verifyToken, (req, res) => {
    res.render('receiver', {userName: req.userName});
    //res.sendFile(__dirname + '/views/index.ejs');
});

app.use(express.static(__dirname))
//app.listen(8081, () => console.log('Node.js app running on localhost:8081'));

const SECRET_KEY = '0ea38897925118e4ab1d18f5a13b6cd50094b326df9655222a9cb7dcb2c1e9ff';
function verifyToken(req, res, next){
    let token = req.cookies.jwt;
    let userName = null;
    if(token && token.startsWith('Bearer-')){
        token = token.slice(7);
    }
    //console.log('Raw cookie:', req.headers.cookie);
    //console.log('Received token:', token);
    if(!token){
        return res.status(403).send('Token is missing!');
    }
    //console.log("Check 1!");
    jwt.verify(token, SECRET_KEY, (err, decodedToken) => {
        if(err) {
            console.log(err);
            return res.status(403).send('Invalid Token');
        }
        req.userName = decodedToken.sub;
        //console.log(userName);
        //console.log(req.userName);
        next();
    })
    //console.log(userName);
    //console.log("Check 2!");
    
}

module.exports = verifyToken;

const key = fs.readFileSync('cert.key');
const cert = fs.readFileSync('cert.crt');


const expressServer = https.createServer({key, cert}, app);

const io = socketio(expressServer,{
    //path: '/live/socket.io',
    cors: {
        origin: [
            //"https://localhost",
            'https://192.168.0.151' ,
            'https://172.20.10.3',
            //"http://localhost/socket.io",
            //"https://localhost/live",
            "https://localhost/live"
        ],
        methods: ["GET", "POST"]
    }
});
expressServer.listen(8181);


const offers = [
    // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
];
const connectedSockets = [
    //username, socketId
]

io.on('connection',(socket)=>{
    
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;
    console.log(userName + "   " + password);
    if(password !== "x"){
        socket.disconnect(true);
        return;
    }
    connectedSockets.push({
        socketId: socket.id,
        userName
    })

    if(offers.length){
        socket.emit('availableOffers',offers);
    }
    
    socket.on('newOffer',newOffer=>{
        offers.push({
            offererUserName: userName,
            offer: newOffer,
            offerIceCandidates: [],
            answererUserName: null,
            answer: null,
            answererIceCandidates: []
        })
        socket.broadcast.emit('newOfferAwaiting',offers.slice(-1))
    })

    socket.on('newAnswer',(offerObj,ackFunction)=>{
        console.log(offerObj);

        const socketToAnswer = connectedSockets.find(s=>s.userName === offerObj.offererUserName)
        if(!socketToAnswer){
            console.log("No matching socket")
            return;
        }
        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(o=>o.offererUserName === offerObj.offererUserName)
        if(!offerToUpdate){
            console.log("No OfferToUpdate")
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj.answer
        offerToUpdate.answererUserName = userName

        socket.to(socketIdToAnswer).emit('answerResponse',offerToUpdate)
    })

    socket.on('sendIceCandidateToSignalingServer',iceCandidateObj=>{
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;
        // console.log(iceCandidate);
        if(didIOffer){
           
            const offerInOffers = offers.find(o=>o.offererUserName === iceUserName);
            if(offerInOffers){
                offerInOffers.offerIceCandidates.push(iceCandidate)
            
                if(offerInOffers.answererUserName){
                    
                    const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.answererUserName);
                    if(socketToSendTo){
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
                    }else{
                        console.log("Ice candidate recieved but could not find answere")
                    }
                }
            }
        }else{
            
            const offerInOffers = offers.find(o=>o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s=>s.userName === offerInOffers.offererUserName);
            if(socketToSendTo){
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer',iceCandidate)
            }else{
                console.log("Ice candidate recieved but could not find offerer")
            }
        }
        // console.log(offers)
    })

})