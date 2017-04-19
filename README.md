# Databreeze API Server

The **Databreeze** database API server responds to ajax requests from the [Databreeze application server](https://github.com/DataBreeze/dbz) server or web client via fetch ajax calls. This API Server allows account creation, login and account management using json web tokens (JWT). It allows read and write access to a mongodb server and enforces owner-edit. The system handles image uploads including the creation of multiple resized images before uploading the images to Amazon S3.

The server utilizes nodeJS and expressJS to handle web requests/responses and mongoose to query the mongodb database server.

## Github modules used:
* bcrypt to hash passwords
* cluster to add scaleability
* cookie-parser to receive JWT cookie
* express server
* jsonwebtoken to validate user
* mongoose to access mongoDB
* multer to handle uploaded files and form data
* nodemailer to send password reset emails that allow users to reset their passwords
* S3-uploader to resize images and upload them to S3

## Installation

### In order to operate the [Databreeze application server](https://github.com/DataBreeze/dbz), this API server is required. This repo will need to be downloaded and installed and then the system needs to be configured. By default the application attempts to run the express server on port 3011. You may wish to use nginx or apache to proxy pass http or https calls to the node/express API server.

### download and install the source

- git clone git@github.com:DataBreeze/dbzApi.git

- cd dbzApi

- npm install


### Create and edit the configuration files (required):

- [conf/README.md](https://github.com/DataBreeze/dbzApi/blob/master/conf/README.md)

