ThisApp.extend({
    /**
     * Firebase wrapper object
     * @returns {Object}
     */
    FB: function () {
        var _this = this;
        return {
            /**
             * Executes the callback when a new data is added at the given location
             * @param {string} location
             * @param {function} successCallback
             * @returns {Promise}
             */
            onAdded: function (location, successCallback) {
                var _this = this;
                return this.ref(location).on('child_added', function (resp) {
                    _this.call(successCallback, resp);
                });
            },
            /**
             * Executes the callback when the data at the given location is changed
             * @param {string} location
             * @param {function} successCallback
             * @returns {Promise}
             */
            onChanged: function (location, successCallback) {
                var _this = this;
                return this.ref(location).on('child_changed', function (resp) {
                    _this.call(successCallback, resp);
                });
            },
            /**
             * Executes the callback when the data at the given location is removed
             * @param {string} location
             * @param {function} successCallback
             * @returns {Promise}
             */
            onRemoved: function (location, successCallback) {
                var _this = this;
                return this.ref(location).on('child_removed', function (resp) {
                    _this.call(successCallback, resp);
                });
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
                if (addedCallback)
                    this.onAdded(location, addedCallback);
                if (changedCallback)
                    this.onChanged(location, changedCallback);
                if (removedCallback)
                    this.onRemoved(location, removedCallback);
                return this;
            },
            unwatch: function (location) {
                return this.ref(location).off();
            },
            /**
             * Creates a new node at the given location with the given data
             * @param {string} location
             * @param {object} data
             * @return {string} The key of the new node
             */
            create: function (location, data) {
                if (!location || !data)
                    return false;
                var ref = this.ref(location).push(),
                        uid = ref.key;
                if (_this.fbConfig.uid)
                    data[_this.fbConfig.uid] = uid;
                ref.set(data);
                return uid;
            },
            /**
             * Reads the data at the given location once and calls the callback on it
             * @param {string} location
             * @param {function} successCallback
             * @return {Promise}
             */
            read: function (location, successCallback) {
                if (!location)
                    return false;
                var _this = this;
                return this.ref(location).once('value').then(function (resp) {
                    _this.call(successCallback, resp);
                });
            },
            /**
             * Updates the node at the given location with the given data
             * @param {string} location
             * @param {object} data
             * @returns {Promise}
             */
            update: function (location, data) {
                if (!location || !data)
                    return false;
                return this.ref(location).update(data);
            },
            /**
             * Delete the node at the given location
             * @param {string} location
             * @returns {Promise}
             */
            delete: function (location) {
                if (!location)
                    return false;
                return this.ref(location).remove();
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
                    console.error(e.message);
                }
                return this;
            }
        };
    },
    /**
     * Initiates Firebase connection with the given configuration
     * @param {Object} fbConfig
     * return {ThisApp}
     */
    firebase: function (fbConfig) {
        if (this.running)
            throw 'Method firebase() must be called before method start()';

        var _this = this;
        this.fbWatching = {};
        // initialize callbacks properties
        this.fbSuccess = {create: {}, update: {}, delete: {}};
        this.fbError = {create: {}, update: {}, delete: {}};
        this.fbConfig = this.__.extend({
            auth: false,
            uid: 'id'
        }, fbConfig);
        // intialize 
        firebase.initializeApp(fbConfig);
        // watch collections
        this.watch(function (location, success, error) {
            if (!location.endsWith('/'))
                location += '/';
            _this.FB().watch(location, function (data, id) {
                if (_this.fbConfig.uid)
                    data[_this.fbConfig.uid] = id;
                _this.__.callable(success)
                        .call(null, data, _this.fbConfig.uid, 'created');
                _this.__.callable(_this.fbSuccess.create[location])
                        .call(null, data, _this.fbConfig.uid, 'created');
                delete _this.fbSuccess.create[location];
                delete _this.fbError.create[location];
            }, function (data, id) {
                if (_this.fbConfig.uid)
                    data[_this.fbConfig.uid] = id;
                _this.__.callable(success)
                        .call(null, data, _this.fbConfig.uid, 'updated');
                _this.__.callable(_this.fbSuccess.update[location])
                        .call(null, data, _this.fbConfig.uid, 'updated');
                delete _this.fbSuccess.update[location];
                delete _this.fbError.update[location];
            }, function (data, id) {
                if (_this.fbConfig.uid)
                    data[_this.fbConfig.uid] = id;
                _this.__.callable(success)
                        .call(null, data, _this.fbConfig.uid, 'deleted');
                _this.__.callable(_this.fbSuccess.delete[location])
                        .call(null, data, _this.fbConfig.uid, 'deleted');
                delete _this.fbSuccess.delete[location];
                delete _this.fbError.delete[location];
            });
            _this.fbWatching[location] = true;
        });
        // set transporter
        this.setDataTransport(function (config) {
            /*
             * config may contain action, id, url, data, success and error.
             */
            // register callbacks
            if (config.action === 'create') {
                _this.fbSuccess[config.action][config.url] = config.success;
                _this.fbError[config.action][config.url] = config.error;
            }
            if (config.action === 'update' || config.action === 'delete') {
                // url should look like collection's to trigger watching

                // remove id from url
                var parts = config.url.split('/');
                _this.__.arrayRemove(parts, parts.length - 1);

                _this.fbSuccess[config.action][parts.join("/") + '/'] = config.success;
                _this.fbError[config.action][parts.join("/") + '/'] = config.error;
            }
            // execute appropriate action
            switch (config.action) {
                case 'create':
                    return _this.FB().create(config.url, config.data);
                case 'read':
                    _this.FB().read(config.url,
                            function (data, id) {
                                // add uid to data if collection
                                if (_this.fbConfig.uid && !config.collection)
                                    data[_this.fbConfig.uid] = id;
                                this.__.callable(config.success).call(this, data, _this.fbConfig.uid);
                            }.bind(this),
                            config.error);
                    break;
                case 'update':
                    _this.FB().update(config.url, config.data);
                    break;
                case 'delete':
                    _this.FB().delete(config.url);
                    break;
                case 'search':
                    break;
            }
            return true;
        });
        return this.cacheData(false).setDataKey(null);
    }
});