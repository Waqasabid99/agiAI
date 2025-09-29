require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const chatRouter = require('./chatbot');
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
    res.send('Hello World!')
})
app.use('/api', chatRouter);

app.listen(PORT, () => {
    console.log(`Example app listening on port http://localhost:${PORT}`)
})