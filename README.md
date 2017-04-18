#Databreeze API Server

The **Databreeze** database API server responds to ajax requests from the Databreeze application server or web client via fetchjs ajax calls. This API Server allows account creation, login and account management using json web tokens (JWT). It allows read and wrie access to a mongodb server. The system handles image uploads including the creation of multiple resized images before uploading the images to Amazon S3.

The server utilizes nodeJS and expressJS to handle web requests/responses and mongoose to query the mongodb database server.

##Github modules used:
* bcrypt to hash passwords
* cluster to add scaleability
* cookie-parser to validate JWT
* express server
* jsonwebtoken to validate user
* mongoose to access mongoDB
* multer to handle uploaded files and form data
* nodemailer to send password reset emails that allow users to reset their passwords
* S3-uploader to resize images and upload them to S3

In order to operate the Databreeze application server, an API server is required. This repo will need to be downloaded and installed and then the system needs to be configured:

copy dbzApi/conf/Config.js.example to dbzApi/conf/Config.js and edit the file to add your config settings. If this is not done the api server will not start

copy dbzApi/conf/S3Config.js.example to dbzApi/conf/S3Config.js and edit the file to add your Amazon S3 specific settings. If this is not done file uploads to S3 will not function.

##installation
git clone git@github.com:DataBreeze/dbzApi.git
cd dbzApi
npm install
