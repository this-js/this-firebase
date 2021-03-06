ThisApp.extend({
    /**
     * Firebase wrapper object
     * @returns {Object}
     */
    FB: function (internal) {
        var _this = this;

        /**
         * Checks whether the given event can be watched with the other parameters
         * @param {string} event added | changed | removed
         * @param {string} location
         * @param {Function} callback
         * @param {Boolean} overwrite
         * @returns {Boolean}
         */
        var canWatch = function (event, location, callback, overwrite) {
            return (callback && (!FB.eventCallbacks[event][location] ||
                    (FB.eventCallbacks[event][location] && overwrite)));
        },
                FB = {
                    updatedEvents: {added: {}, changed: {}, removed: {}},
                    eventCallbacks: {added: {}, changed: {}, removed: {}},
                    /**
                     * Checks if there's an active connection to Firebase
                     * @param {Function} callback
                     * @returns {Promise}
                     */
                    isConnected: function (callback) {
                        return this.read('.info/connected', callback);
                    },
                    /**
                     * Calls the callback when firebase is connected or reconnected to
                     * @param {Function} callback
                     * @returns {FB}
                     */
                    onConnected: function (callback) {
                        // monitor connection status
                        this.ref('.info/connected').on('value', function (snap) {
                            if (snap.val())
                                _this.__.callable(callback).call(_this);
                        });
                        return this;
                    },
                    /**
                     * Calls the callback when the connection to firebase is lost
                     * @param {Function} callback
                     * @returns {FB}
                     */
                    onDisconnected: function (callback) {
                        // monitor connection status
                        this.ref('.info/connected').on('value', function (snap) {
                            if (!snap.val())
                                _this.__.callable(callback).call(_this);
                        });
                        return this;
                    },
                    /**
                     * Executes the callback when a new data is added at the given location
                     * @param {string} location
                     * @param {function} callback
                     * @returns {Promise}
                     */
                    onAdded: function (location, callback, overwrite) {
                        var fb = this;
                        if (!canWatch('added', location, callback, overwrite))
                            return this;
                        this.eventCallbacks.added[location] = callback;
                        this.ref(location).on('child_added', function (resp) {
                            // skip for the first time
                            if (!_this.fbCanAdd[location][resp.key]) {
                                _this.fbCanAdd[location][resp.key] = true;
                                return;
                            }
                            if (!fb.updatedEvents.added[location])
                                fb.call(callback, resp);
                            delete fb.updatedEvents.added[location];
                        });
                        return this;
                    },
                    /**
                     * Removes the callback listener for when a child is added on the location
                     * @param {string} location
                     * @returns {FB}
                     */
                    ignoreAdded: function (location) {
                        return this.off(location, 'child_added');
                    },
                    /**
                     * Executes the callback when the data at the given location is changed
                     * @param {string} location
                     * @param {function} callback
                     * @returns {Promise}
                     */
                    onChanged: function (location, callback, overwrite) {
                        var _this = this;
                        if (!canWatch('changed', location, callback, overwrite))
                            return this;
                        this.eventCallbacks.changed[location] = callback;
                        this.ref(location).on('child_changed', function (resp) {
                            if (!_this.updatedEvents.changed[location])
                                _this.call(callback, resp);
                            delete _this.updatedEvents.changed[location];
                        });
                        return this;
                    },
                    /**
                     * Removes the callback listener for when a child is changed on the location
                     * @param {string} location
                     * @returns {FB}
                     */
                    ignoreChanged: function (location) {
                        return this.off(location, 'child_changed');
                    },
                    /**
                     * Executes the callback when the data at the given location is removed
                     * @param {string} location
                     * @param {function} callback
                     * @returns {Promise}
                     */
                    onRemoved: function (location, callback, overwrite) {
                        var _this = this;
                        if (!canWatch('removed', location, callback, overwrite))
                            return this;
                        this.eventCallbacks.removed[location] = callback;
                        this.ref(location).on('child_removed', function (resp) {
                            if (!_this.updatedEvents.removed[location])
                                _this.call(callback, resp);
                            delete _this.updatedEvents.removed[location];
                        });
                        return this;
                    },
                    /**
                     * Removes the callback listener for when a child is removed from the location
                     * @param {string} location
                     * @returns {FB}
                     */
                    ignoreRemoved: function (location) {
                        return this.off(location, 'child_removed');
                    },
                    /**
                     * Watches the location for changes from the server and calls the callback when such
                     * occurs
                     * @param {string} location
                     * @param {function} addedCallback
                     * @param {function} updatedCallback
                     * @param {function} removedCallback
                     * @returns {FB}
                     */
                    watch: function (location, addedCallback, changedCallback,
                            removedCallback) {
                        this.onAdded(location, addedCallback);
                        this.onChanged(location, changedCallback);
                        this.onRemoved(location, removedCallback);
                        return this;
                    },
                    /**
                     * Stops watching the location for changes from the server
                     * @param {string} location
                     * @returns {FB}
                     */
                    unwatch: function (location) {
                        this.ignoreAdded(location);
                        this.ignoreChanged(location);
                        this.ignoreRemoved(location);
                        return this;
                    },
                    /**
                     * Removes an event listener for the location
                     * @param {string} location
                     * @param {string} event value|child_added|child_changed|child_removed
                     * @returns {FB}
                     */
                    off: function (location, event) {
                        if (event) {
                            var _event = event.split('_')[1];
                            if (_event && this.eventCallbacks[_event])
                                delete this.eventCallbacks[_event][location];
                            this.ref(location).off(event);
                        }
                        return this;
                    },
                    /**
                     * Creates a new node at the given location with the given data
                     * @param {string} location
                     * @param {object} data
                     * @param {Function} successCallback
                     * @param {Function} errorCallback
                     * @return {string} The key of the new node
                     */
                    create: function (location, data, successCallback, errorCallback) {
                        if (!location || !data)
                            return false;

                        var ref = this.ref(location).push(),
                                uid = ref.key;
                        // add id to data
                        if (_this.fbConfig.uid && !data[_this.fbConfig.uid])
                            data[_this.fbConfig.uid] = uid;

                        ref = ref.set(data);
                        if (_this.transporterOnline)
                            ref.then(successCallback).catch(errorCallback);
                        else {
                            this.updatedEvents.added[location] = true;
                            _this.__.callable(this.eventCallbacks.added[location])
                                    .call(this, data, uid);
                            _this.__.callable(successCallback).call(_this, data, uid, _this.transporterOnline);
                            ref.catch(function () {
                                _this.__.callable(this.eventCallbacks.removed[location])
                                        .call(this, data, uid);
                                _this.__.callable(errorCallback).call(_this, _this.transporterOnline);
                            });
                        }
                        return ref;
                    },
                    /**
                     * Reads the data at the given location once and calls the callback on it
                     * @param {string} location
                     * @param {function} successCallback
                     * @param {function} errorCallback
                     * @return {Promise}
                     */
                    read: function (location, successCallback, errorCallback) {
                        if (!location)
                            return false;
                        var _this = this;
                        return this.ref(location).once('value')
                                .then(function (resp) {
                                    _this.call(successCallback, resp);
                                })
                                .catch(errorCallback);
                    },
                    /**
                     * Updates the node at the given location with the given data
                     * @param {string} location
                     * @param {object} data
                     * @param {Function} successCallback
                     * @param {Function} errorCallback
                     * @returns {Promise}
                     */
                    update: function (location, data, successCallback, errorCallback) {
                        if (!location || !data)
                            return false;
                        var ref = this.ref(location).update(data),
                                fb = this;
                        if (_this.transporterOnline)
                            ref.then(successCallback).catch(errorCallback);
                        else {
                            this.updatedEvents.added[location] = true;
                            _this.__.callable(this.eventCallbacks.added[location])
                                    .call(this, data, data[_this.fbConfig.uid]);
                            _this.__.callable(successCallback).call(_this, data, data[_this.fbConfig.uid],
                                    _this.transporterOnline);
                            ref.catch(function () {
                                // update with current copy
                                fb.read(location, function (data, id) {
                                    _this.__.callable(this.eventCallbacks.updated[location])
                                            .call(this, data, id);
                                    _this.__.callable(errorCallback).call(_this, _this.transporterOnline);
                                });
                            });
                        }
                        return ref;
                    },
                    /**
                     * Delete the node at the given location
                     * @param {string} location
                     * @param {Function} successCallback
                     * @param {Function} errorCallback
                     * @returns {Promise}
                     */
                    delete: function (location, successCallback, errorCallback) {
                        if (!location)
                            return false;
                        var ref = this.ref(location).remove(),
                                fb = this;
                        if (_this.transporterOnline)
                            ref.then(successCallback).catch(errorCallback);
                        else {
                            this.updatedEvents.added[location] = true;
                            _this.__.callable(this.eventCallbacks.added[location])
                                    .call(this);
                            _this.__.callable(successCallback).call(_this);
                            ref.catch(function () {
                                // add existing copy back
                                fb.read(location, function (data, id) {
                                    _this.__.callable(this.eventCallbacks.added[location])
                                            .call(this, data, id);
                                    _this.__.callable(successCallback).call(_this, data, id, _this.transporterOnline);

                                });
                            });
                        }
                        return ref;
                    },
                    /**
                     * Fetches a reference to the given location
                     * @param {string} location
                     * @returns {object} A reference to the database at the given location. If no location
                     * is given, the reference points to the root node of the database
                     */
                    ref: function (location) {
                        return firebase.database().ref(location);
                    },
                    /**
                     * Calls the given callback with the given database snapshot
                     * @param {function} callback
                     * @param {function} snapshot
                     * @returns {FB}
                     */
                    call: function (callback, snapshot) {
                        try {
                            _this.__.callable(callback).call(this, snapshot.val(), snapshot.key);
                        }
                        catch (e) {
                            _this.error(e.message);
                        }
                        return this;
                    }
                };
        return FB;
    },
    /**
     * Initiates Firebase connection with the given configuration
     * @param {Object} fbConfig
     * return {ThisApp}
     */
    firebase: function (internal, fbConfig) {
        this.console('group', 'Firebase');
        this.tryCatch(function () {
            if (this.running)
                throw 'Method firebase() must be called before method start()';
            var _this = this,
                    inited = false;
            // indicates the locations that can be added.
            this.fbCanAdd = {};
            // initialize callbacks properties
            this.fbCallbacks = {
                success: {create: {}, update: {}, delete: {}},
                error: {create: {}, update: {}, delete: {}}
            };
            this.fbConfig = this.__.extend({
                auth: false,
                uid: 'id',
                connectionChanged: function (status) {
                    if (!status)
                        _this.error('Connection lost!');
                    else
                        _this.console('log', 'Connection established!');
                }
            }, fbConfig);
            // don't use data key
            this.setDataKey(null);
            // intialize 
            firebase.initializeApp(fbConfig);
            this.transporterOnline = true;
            // monitor connection status
            this.FB().ref('.info/connected').on('value', function (snap) {
                // only update transporter online status when the app is running
                if (_this.running)
                    _this.transporterOnline = snap.val();
                if (inited) // only call connection changed when firebase has been fully intialized
                    _this.__.callable(_this.fbConfig.connectionChanged).call(_this, snap.val());
            });
            // watch collections
            this.watch(function (location, callback) {
                if (!location.endsWith('/'))
                    location += '/';
                _this.fbCanAdd[location] = {};
                _this.FB().watch(location,
                        function (data, id) {
                            if (_this.fbConfig.uid)
                                data[_this.fbConfig.uid] = id;
                            _this.__.callable(callback)
                                    .call(null, {
                                        data: data,
                                        uid: _this.fbConfig.uid,
                                        event: 'created',
                                        isConnected: _this.transporterOnline,
                                        id: id
                                    });
                        },
                        function (data, id) {
                            if (_this.fbConfig.uid)
                                data[_this.fbConfig.uid] = id;
                            _this.__.callable(callback)
                                    .call(null, {
                                        data: data,
                                        uid: _this.fbConfig.uid,
                                        event: 'updated',
                                        isConnected: _this.transporterOnline,
                                        id: id
                                    });
                        },
                        function (data, id) {
                            if (_this.fbConfig.uid)
                                data[_this.fbConfig.uid] = id;
                            _this.__.callable(callback)
                                    .call(null, {
                                        data: data,
                                        uid: _this.fbConfig.uid,
                                        event: 'deleted',
                                        isConnected: _this.transporterOnline,
                                        id: id
                                    });
                        });
            });
            // set transporter
            this.setDataTransport(function (config) {
                /*
                 * config may contain action, id, url, data, success and error.
                 */
                // register callbacks
                if (config.action === 'create') {
                    _this.fbCallbacks.success[config.action][config.url] = config.success;
                    _this.fbCallbacks.error[config.action][config.url] = config.error;
                }
                if (config.action === 'update' || config.action === 'delete') {
                    // url should look like collection's to trigger watching

                    // remove id from url
                    var parts = config.url.split('/');
                    _this.__.arrayRemove(parts, parts.length - 1);

                    _this.fbCallbacks.success[config.action][parts.join("/") + '/'] = config.success;
                    _this.fbCallbacks.error[config.action][parts.join("/") + '/'] = config.error;
                }
                // execute appropriate action
                switch (config.action) {
                    case 'create':
                        return _this.FB().create(config.url, config.data, config.success, config.error);
                    case 'read':
                        _this.FB().read(config.url,
                                function (data, id) {
                                    // add uid to data if collection
                                    if (data && _this.fbConfig.uid && !config.isCollection)
                                        data[_this.fbConfig.uid] = id;
                                    this.__.callable(config.success).call(this, data,
                                            _this.fbConfig.uid);
                                }.bind(this),
                                config.error);
                        break;
                    case 'update':
                        _this.FB().update(config.url, config.data, config.success, config.error);
                        break;
                    case 'delete':
                        _this.FB().delete(config.url, config.success, config.error);
                        break;
                    case 'search':
                        break;
                }
                return true;
            });
            inited = true;
        }, function (e) {
            if (!this.transporterOnline)
                this.fbConfig.connectionChanged(false);
        });
        this.console('groupEnd');
        return this;
    }
});