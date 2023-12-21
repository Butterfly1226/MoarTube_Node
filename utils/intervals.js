const { maintainFileSystem } = require("./filesystem");




setInterval(function() {
    const nodeSettings = getNodeSettings();
    
    if(nodeSettings.isNodeConfigured && !nodeSettings.isNodePrivate) {
        database.all('SELECT * FROM videos WHERE is_indexed = 1 AND is_index_outdated = 1', function(error, rows) {
            if(error) {
                logDebugMessageToConsole(null, error, new Error().stack, true);
            }
            else {
                if(rows.length > 0) {
                    performNodeIdentification(false)
                    .then(() => {
                        const nodeIdentification = getNodeIdentification();
                        
                        const nodeIdentifier = nodeIdentification.nodeIdentifier;
                        const nodeIdentifierProof = nodeIdentification.nodeIdentifierProof;
                        
                        rows.forEach(function(row) {
                            const videoId = row.video_id;
                            const title = row.title;
                            const tags = row.tags;
                            const views = row.views;
                            const isStreaming = (row.is_streaming === 1);
                            const lengthSeconds = row.length_seconds;

                            const nodeIconBase64 = getNodeIconBase64();

                            const videoPreviewImageBase64 = fs.readFileSync(path.join(VIDEOS_DIRECTORY_PATH, videoId + '/images/preview.jpg')).toString('base64');
                            
                            indexer_doIndexUpdate(nodeIdentifier, nodeIdentifierProof, videoId, title, tags, views, isStreaming, lengthSeconds, nodeIconBase64, videoPreviewImageBase64)
                            .then(async indexerResponseData => {
                                if(indexerResponseData.isError) {
                                    logDebugMessageToConsole(indexerResponseData.message, null, new Error().stack, true);
                                }
                                else {
                                    const release = await mutex.acquire();
                                    
                                    const type = 'update';
                                    const query = 'UPDATE videos SET is_index_outdated = 0 WHERE video_id = ?';
                                    const parameters = [videoId];
                                    
                                    const databaseWriteJob = {
                                        type: type, // insert, update, delete
                                        query: query, // sql query
                                        parameters: parameters // sql query parameters (if insert or update, otherwise empty array)
                                    };
                                    
                                    try {
                                        await performDatabaseWriteJob(databaseWriteJob);
                                        
                                        logDebugMessageToConsole('updated video id with index successfully: ' + videoId, null, null, true);
                                    }
                                    catch(error) {
                                        logDebugMessageToConsole(null, error, new Error().stack, true);
                                    }
                                    finally {
                                        release();
                                    }
                                }
                            })
                            .catch(error => {
                                logDebugMessageToConsole(null, error, new Error().stack, true);
                            });
                        });
                    })
                    .catch(error => {
                        logDebugMessageToConsole(null, error, new Error().stack, true);
                    });
                }
            }
        });
    }
}, 3000);

setInterval(function() {
    Object.values(cluster.workers).forEach((worker) => {
        worker.send({ cmd: 'live_stream_worker_stats_request' });
    });
}, 1000);

setInterval(function() {
    Object.values(cluster.workers).forEach((worker) => {
        worker.send({ cmd: 'live_stream_worker_stats_update', liveStreamWorkerStats: liveStreamWorkerStats });
    });
}, 1000);

setInterval(function() {
    maintainFileSystem(database)
    .then(function() {
        // do nothing
    })
    .catch(function(error) {
        logDebugMessageToConsole(null, error, new Error().stack, true);
    });
}, 5000);