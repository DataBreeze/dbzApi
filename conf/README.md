# Databreeze API Server Configuration

## You must configure the API Server by creating the config files before running the server

### Create and edit the main configuration file.

- `cd dbzApi/conf`

- `cp Config.js.example Config.js`

- edit the file to add your config settings. Here you will find options for JWT secret, salt, email settings (used for password reset), ports, mongoDB access url, upload settings and cookie settings.


### Create and edit the S3Config.js file:

- `cp S3Config.js.example S3Config.js`

- `cp S3Config.js.example to S3Config.js`

- edit the file to add your Amazon S3 specific settings. Your S3 bucket should be set in place of 'yourS3BucketName'. The rest of the settings are defined by the `s3-uploader` configuration. Please see the [s3-uploader](https://github.com/Turistforeningen/node-s3-uploader) documentation for more information.