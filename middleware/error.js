const ErrorHandler= require('../utils/ErrorHandler.js');

module.exports= (err, req, res, next)=>{

    err.statusCode= err.statusCode || 500;
    err.message= err.message || "Internal Server Error";


    //wrong mongodb id Error
    if(err.name=="CastError"){
        const message= `Resources not found with this id.. Invalid ${err.path}`;
        err= new ErrorHandler(message, 400);
    }

    //duploicate key Error
    if(err.code== 11000){
        const message= `Duplicate key ${Object.keys(err.keyValue)} Entered`;
        err= new ErrorHandler(message, 400);
    }

    //wrong jwt Error 
    if(err.name== 'JsonWebTokenError'){
        const message = "Your url is Invalid please try again later";
        err= new ErrorHandler(message, 400);
    }

    //jwt expired
    if(err.name == 'TokenExpiredError'){
        const message= 'Your url is expired please try again later';
        err= new ErrorHandler(message, 400);
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
}


