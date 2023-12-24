const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const { logDebugMessageToConsole } = require('../utils/logger');
const { getImagesDirectoryPath, getCertificatesDirectoryPath, getDataDirectoryPath, getPublicDirectoryPath
} = require('../utils/paths');
const { getAuthenticationStatus, getNodeSettings, setNodeSettings, getNodeIdentification, performNodeIdentification, 
    getIsDockerEnvironment
} = require('../utils/helpers');
const { 
    isNodeNameValid, isNodeAboutValid, isNodeIdValid, isBooleanValid, isBooleanStringValid, isUsernameValid, isPasswordValid, 
    isPublicNodeProtocolValid, isPublicNodeAddressValid, isPortValid
} = require('../utils/validators');
const { indexer_doNodePersonalizeUpdate, indexer_doNodeExternalNetworkUpdate } = require('../utils/indexer-communications');
const { submitDatabaseWriteJob } = require('../utils/database');

function root_GET(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            const nodeSettings = getNodeSettings();
            
            res.send({isError: false, nodeSettings: nodeSettings});
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function avatar_GET(req, res) {
    const customAvatarDirectoryPath = path.join(path.join(getDataDirectoryPath(), 'images'), 'avatar.png');
    const defaultAvatarDirectoryPath = path.join(path.join(getPublicDirectoryPath(), 'images'), 'avatar.png');
    
    var avatarFilePath;

    if(fs.existsSync(customAvatarDirectoryPath)) {
        avatarFilePath = customAvatarDirectoryPath;
    }
    else if(fs.existsSync(defaultAvatarDirectoryPath)) {
        avatarFilePath = defaultAvatarDirectoryPath;
    }
    
    if (avatarFilePath != null) {
        const fileStream = fs.createReadStream(avatarFilePath);
        
        res.setHeader('Content-Type', 'image/png');
        
        fileStream.pipe(res);
    }
    else {
        res.status(404).send('avatar not found');
    }
}

function avatar_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            logDebugMessageToConsole('uploading node avatar', null, null, true);
            
            multer(
            {
                fileFilter: function (req, file, cb) {
                    const mimeType = file.mimetype;
                    
                    if(mimeType === 'image/png') {
                        cb(null, true);
                    }
                    else {
                        cb(new Error('Invalid file upload mime type detected!'));
                    }
                },
                storage: multer.diskStorage({
                    destination: function (req, file, cb) {
                        fs.access(getImagesDirectoryPath(), fs.constants.F_OK, function(error) {
                            if(error) {
                                cb(new Error('file upload error'), null);
                            }
                            else {
                                cb(null, getImagesDirectoryPath());
                            }
                        });
                    },
                    filename: function (req, file, cb) {
                        var extension;
                        
                        if(file.mimetype === 'image/png') {
                            extension = '.png';
                        }
                        
                        const fileName = uuidv4() + extension;
                        
                        cb(null, fileName);
                    }
                })
            }).fields([{ name: 'iconFile', maxCount: 1 }, { name: 'avatarFile', maxCount: 1 }])
            (req, res, async function(error)
            {
                if(error) {
                    logDebugMessageToConsole(null, error, new Error().stack, true);
                    
                    res.send({isError: true, message: error.message});
                }
                else {
                    logDebugMessageToConsole('uploaded node avatar', null, null, true);
                    
                    const iconFile = req.files['iconFile'][0];
                    const avatarFile = req.files['avatarFile'][0];
                    
                    const iconSourceFilePath = path.join(getImagesDirectoryPath(), iconFile.filename);
                    const avatarSourceFilePath = path.join(getImagesDirectoryPath(), avatarFile.filename);
                    
                    const iconDestinationFilePath = path.join(getImagesDirectoryPath(), 'icon.png');
                    const avatarDestinationFilePath = path.join(getImagesDirectoryPath(), 'avatar.png');
                    
                    fs.renameSync(iconSourceFilePath, iconDestinationFilePath);
                    fs.renameSync(avatarSourceFilePath, avatarDestinationFilePath);

                    submitDatabaseWriteJob('UPDATE videos SET is_index_outdated = CASE WHEN is_indexed = 1 THEN 1 ELSE is_index_outdated END', [], function(isError) {
                        if(isError) {
                            res.send({isError: true, message: 'error communicating with the MoarTube node'});
                        }
                        else {
                            res.send({isError: false});
                        }
                    });
                }
            });
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function banner_GET(req, res) {
    const customBannerDirectoryPath = path.join(path.join(getDataDirectoryPath(), 'images'), 'banner.png');
    const defaultBannerDirectoryPath = path.join(path.join(getPublicDirectoryPath(), 'images'), 'banner.png');
    
    var bannerFilePath;

    if(fs.existsSync(customBannerDirectoryPath)) {
        bannerFilePath = customBannerDirectoryPath;
    }
    else if(fs.existsSync(defaultBannerDirectoryPath)) {
        bannerFilePath = defaultBannerDirectoryPath;
    }
    
    if (bannerFilePath != null) {
        const fileStream = fs.createReadStream(bannerFilePath);
        
        res.setHeader('Content-Type', 'image/png');
        
        fileStream.pipe(res);
    }
    else {
        res.status(404).send('banner not found');
    }
}

function banner_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            logDebugMessageToConsole('uploading node banner', null, null, true);
            
            multer(
            {
                fileFilter: function (req, file, cb) {
                    const mimeType = file.mimetype;
                    
                    if(mimeType === 'image/png') {
                        cb(null, true);
                    }
                    else {
                        cb(new Error('Invalid file upload mime type detected!'));
                    }
                },
                storage: multer.diskStorage({
                    destination: function (req, file, cb) {
                        fs.access(getImagesDirectoryPath(), fs.constants.F_OK, function(error) {
                            if(error) {
                                cb(new Error('file upload error'), null);
                            }
                            else {
                                cb(null, getImagesDirectoryPath());
                            }
                        });
                    },
                    filename: function (req, file, cb) {
                        var extension;
                        
                        if(file.mimetype === 'image/png') {
                            extension = '.png';
                        }
                        
                        const fileName = Date.now() + extension;
                        
                        cb(null, fileName);
                    }
                })
            }).fields([{ name: 'bannerFile', maxCount: 1 }])
            (req, res, async function(error)
            {
                if(error) {
                    logDebugMessageToConsole(null, error, new Error().stack, true);
                    
                    res.send({isError: true, message: error.message});
                }
                else {
                    logDebugMessageToConsole('uploaded node banner', null, null, true);
                    
                    const bannerFile = req.files['bannerFile'][0];
                    
                    const bannerSourceFilePath = path.join(getImagesDirectoryPath(), bannerFile.filename);
                    
                    const bannerDestinationFilePath = path.join(getImagesDirectoryPath(), 'banner.png');
                    
                    fs.renameSync(bannerSourceFilePath, bannerDestinationFilePath);
                    
                    res.send({isError: false});
                }
            });
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function personalize_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            const nodeName = req.body.nodeName;
            const nodeAbout = req.body.nodeAbout;
            const nodeId = req.body.nodeId;
            
            if(isNodeNameValid(nodeName) && isNodeAboutValid(nodeAbout) && isNodeIdValid(nodeId)) {
                const nodeSettings = getNodeSettings();

                nodeSettings.nodeName = nodeName;
                nodeSettings.nodeAbout = nodeAbout;
                nodeSettings.nodeId = nodeId;

                if(!nodeSettings.isNodeConfigured) {
                    res.send({isError: true, message: "personalize unavailable; this node has not performed initial configuration"});
                }
                else {
                    if(nodeSettings.isNodePrivate) {
                        setNodeSettings(nodeSettings);
                        
                        res.send({ isError: false });
                    }
                    else {
                        performNodeIdentification(false)
                        .then(() => {
                            const nodeIdentification = getNodeIdentification();
                            
                            if(nodeIdentification != null) {
                                const nodeIdentifier = nodeIdentification.nodeIdentifier;
                                const nodeIdentifierProof = nodeIdentification.nodeIdentifierProof;
                                
                                indexer_doNodePersonalizeUpdate(nodeIdentifier, nodeIdentifierProof, nodeName, nodeAbout, nodeId)
                                .then(indexerResponseData => {
                                    if(indexerResponseData.isError) {
                                        logDebugMessageToConsole(indexerResponseData.message, null, new Error().stack, true);
                                        
                                        res.send({isError: true, message: indexerResponseData.message});
                                    }
                                    else {
                                        setNodeSettings(nodeSettings);
                                        
                                        res.send({ isError: false });
                                    }
                                })
                                .catch(error => {
                                    logDebugMessageToConsole(null, error, new Error().stack, true);

                                    res.send({isError: true, message: 'error communicating with the MoarTube indexer'});
                                });
                            }
                            else {
                                logDebugMessageToConsole('/settings/personalize attempted retrieving node identification but was null', null, new Error().stack, true);
                                
                                res.send({isError: true, message: 'error communicating with the MoarTube indexer'});
                            }
                        })
                        .catch(error => {
                            logDebugMessageToConsole(null, error, new Error().stack, true);

                            res.send({isError: true, message: 'an unknown error occurred'});
                        });
                    }
                }
            }
            else {
                res.send({ isError: true, message: 'invalid parameters' });
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function private_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            const isNodePrivate = req.body.isNodePrivate;
            
            if(isBooleanValid(isNodePrivate)) {
                const nodeSettings = getNodeSettings();
                
                nodeSettings.isNodePrivate = isNodePrivate;

                setNodeSettings(nodeSettings);
                
                res.send({ isError: false });
            }
            else {
                res.send({ isError: true, message: 'invalid username and/or password' });
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function secure_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then(async (isAuthenticated) => {
        if(isAuthenticated) {
            var isSecure = req.query.isSecure;

            if(isBooleanStringValid(isSecure)) {
                isSecure = (isSecure === 'true');

                if(isSecure) {
                    multer({
                        fileFilter: function (req, file, cb) {
                            cb(null, true);
                        },
                        storage: multer.diskStorage({
                            destination: function (req, file, cb) {
                                fs.access(getCertificatesDirectoryPath(), fs.constants.F_OK, function(error) {
                                    if(error) {
                                        cb(new Error('file upload error'), null);
                                    }
                                    else {
                                        cb(null, getCertificatesDirectoryPath());
                                    }
                                });
                            },
                            filename: function (req, file, cb) {
                                if(file.fieldname === 'keyFile') {
                                    cb(null, 'private_key.pem');
                                }
                                else if(file.fieldname === 'certFile') {
                                    cb(null, 'certificate.pem');
                                }
                                else if(file.fieldname === 'caFiles') {
                                    cb(null, file.originalname);
                                }
                                else {
                                    cb(new Error('invalid field name in POST /settings/secure:' + file.fieldname), null);
                                }
                            }
                        })
                    }).fields([{ name: 'keyFile', maxCount: 1 }, { name: 'certFile', maxCount: 1 }, { name: 'caFiles' }])
                    (req, res, async function(error) {
                        if(error) {
                            logDebugMessageToConsole(null, error, new Error().stack, true);
                            
                            res.send({isError: true, message: 'error communicating with the MoarTube node'});
                        }
                        else {
                            var keyFile = req.files['keyFile'];
                            var certFile = req.files['certFile'];
                            const caFiles = req.files['caFiles'];
                            
                            if(keyFile == null || keyFile.length !== 1) {
                                res.send({isError: true, message: 'private key file is missing'});
                            }
                            else if(certFile == null || certFile.length !== 1) {
                                res.send({isError: true, message: 'cert file is missing'});
                            }
                            else {
                                logDebugMessageToConsole('switching node to HTTPS mode', null, null, true);

                                const nodeSettings = getNodeSettings();
                                
                                nodeSettings.isSecure = true;

                                setNodeSettings(nodeSettings);

                                res.send({isError: false});

                                process.send({ cmd: 'restart_server' });
                            }
                        }
                    });
                }
                else {
                    logDebugMessageToConsole('switching node to HTTP mode', null, null, true);

                    const nodeSettings = getNodeSettings();
                    
                    nodeSettings.isSecure = false;

                    setNodeSettings(nodeSettings);

                    res.send({isError: false});
                    
                    process.send({ cmd: 'restart_server' });
                }
            }
            else {
                res.send({isError: true, message: 'invalid parameters'});
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function account_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            const username = req.body.username;
            const password = req.body.password;
            
            if(isUsernameValid(username) && isPasswordValid(password)) {
                const usernameHash = encodeURIComponent(Buffer.from(bcryptjs.hashSync(username, 10), 'utf8').toString('base64'));
                const passwordHash = encodeURIComponent(Buffer.from(bcryptjs.hashSync(password, 10), 'utf8').toString('base64'));
                
                const nodeSettings = getNodeSettings();
                
                nodeSettings.username = usernameHash;
                nodeSettings.password = passwordHash;

                setNodeSettings(nodeSettings);
                
                res.send({ isError: false });
            }
            else {
                res.send({ isError: true, message: 'invalid username and/or password' });
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function networkInternal_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then(async (isAuthenticated) => {
        if(isAuthenticated) {
            if(getIsDockerEnvironment()) {
                res.send({isError: true, message: 'This node cannot change listening ports because it is running inside of a docker container.'});
            }
            else {
                const listeningNodePort = req.body.listeningNodePort;
                
                if(isPortValid(listeningNodePort)) {
                    logDebugMessageToConsole('switching node to HTTPS mode', null, null, true);

                    const nodeSettings = getNodeSettings();
                    
                    nodeSettings.nodeListeningPort = listeningNodePort;

                    setNodeSettings(nodeSettings);

                    res.send({isError: false});

                    process.send({ cmd: 'restart_server' });
                }
                else {
                    res.send({ isError: true, message: 'invalid parameters' });
                }
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

function networkExternal_POST(req, res) {
    getAuthenticationStatus(req.headers.authorization)
    .then((isAuthenticated) => {
        if(isAuthenticated) {
            const publicNodeProtocol = req.body.publicNodeProtocol;
            const publicNodeAddress = req.body.publicNodeAddress;
            const publicNodePort = req.body.publicNodePort;
            
            if(isPublicNodeProtocolValid(publicNodeProtocol) && isPublicNodeAddressValid(publicNodeAddress) && isPortValid(publicNodePort)) {
                const nodeSettings = getNodeSettings();

                nodeSettings.publicNodeProtocol = publicNodeProtocol;
                nodeSettings.publicNodeAddress = publicNodeAddress;
                nodeSettings.publicNodePort = publicNodePort;
                nodeSettings.isNodeConfigured = true;
                
                if(nodeSettings.isNodePrivate) {
                    setNodeSettings(nodeSettings);
                    
                    res.send({ isError: false });
                }
                else {
                    performNodeIdentification(true)
                    .then(() => {
                        const nodeIdentification = getNodeIdentification();
                        
                        const nodeIdentifier = nodeIdentification.nodeIdentifier;
                        const nodeIdentifierProof = nodeIdentification.nodeIdentifierProof;
                        
                        indexer_doNodeExternalNetworkUpdate(nodeIdentifier, nodeIdentifierProof, publicNodeProtocol, publicNodeAddress, publicNodePort)
                        .then(indexerResponseData => {
                            if(indexerResponseData.isError) {
                                res.send({isError: true, message: indexerResponseData.message});
                            }
                            else {
                                setNodeSettings(nodeSettings);
                                
                                res.send({ isError: false });
                            }
                        })
                        .catch(error => {
                            logDebugMessageToConsole(null, error, new Error().stack, true);
                            
                            res.send({isError: true, message: 'an unknown error occurred'});
                        });
                    })
                    .catch(error => {
                        logDebugMessageToConsole(null, error, new Error().stack, true);
                        
                        res.send({isError: true, message: 'an unknown error occurred'});
                    });
                }
            }
            else {
                res.send({ isError: true, message: 'invalid parameters' });
            }
        }
        else {
            logDebugMessageToConsole('unauthenticated communication was rejected', null, new Error().stack, true);

            res.send({isError: true, message: 'you are not logged in'});
        }
    })
    .catch(error => {
        logDebugMessageToConsole(null, error, new Error().stack, true);
        
        res.send({isError: true, message: 'error communicating with the MoarTube node'});
    });
}

module.exports = {
    root_GET,
    avatar_GET,
    avatar_POST,
    banner_GET,
    banner_POST,
    personalize_POST,
    private_POST,
    secure_POST,
    account_POST,
    networkInternal_POST,
    networkExternal_POST
};