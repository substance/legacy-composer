// Document - acts as a proxy to the underlying ContentGraph
// ---------------

var Document = Backbone.Model.extend({
  
  initialize: function(spec) {      
    // Initialize ContentGraph if present
    if (this.get('contents')) {
      this.g = new ContentGraph(this.get('contents'));
    }
    this.selectedNode = null;
  },
  
  url: function() {
    if (this.id)
      return '/documents/' + this.id;
    else
      return '/documents/';
  },
  
  parse: function(res) {
    if (res.contents) {
      this.g = new ContentGraph(res.contents);
    }
    return res;
  },
  
  toJSON: function() {
    return _.extend(_.clone(this.attributes), {
      contents: this.g.serialize()
    });
  },
  
  createEmptyNode: function(type) {
    var key = this.g.generateId(); // Get a new unique NodeId

    // Create a node with default properties according
    // to the node type
    var data = {children: [], type: type};

    // Set default values
    ContentNode.types[type].properties.forEach(function(p) {
      data[p.key] = p.defaultValue;
    });

    return new ContentNode(this.g, key, data);
  },
  
  moveNode: function(sourceKey, targetKey, destination) {
    var source = this.g.get('nodes', sourceKey),
        target = this.g.get('nodes', targetKey);
    
    if (sourceKey === targetKey) return;
    
    // Remove from old position
    source.parent.removeChild(source.key);
    
    // Attach at new position
    target.parent.addChild(source, target, destination);
    
    this.makeDirtyNode(source.parent.key);
    
    if (source.parent.key !== target.parent.key) {
      this.makeDirtyNode(target.parent.key);
    }
  },
  
  makeDirtyNode: function(nodeKey) {
    var node = this.getNode(nodeKey);
    // node.dirty = true;
    this.trigger('change:node', node);
  },
  
  // Create a node of a given type
  createSiblingAfter: function(type, predecessorKey) {
    var newNode = this.createEmptyNode(type),
        predecessor = this.g.get('nodes', predecessorKey);
        
    newNode.build();
    newNode.parent = predecessor.parent;

    // Attach to ContentGraph
    predecessor.parent.addChild(newNode, predecessor, 'after');
    
    this.trigger('change:node', predecessor.parent);
    this.selectNode(newNode.key);
  },
  
  createSiblingBefore: function(type, successorKey) {
    var newNode = this.createEmptyNode(type),
        successor = this.g.get('nodes', successorKey);
        
    newNode.build();
    newNode.parent = successor.parent;

    // Attach to ContentGraph
    successor.parent.addChild(newNode, successor, 'before');
    
    this.trigger('change:node', successor.parent);
    this.selectNode(newNode.key);
  },
  
  // Create a child node of a given type
  createChild: function(type, parentKey) {
    var newNode = this.createEmptyNode(type),
        parent = this.g.get('nodes', parentKey);
    
    if (parentKey === "root") {
      parent = this.g;
    }
    
    newNode.build();
    newNode.parent = parent;

    // Attach to ContentGraph
    parent.addChild(newNode);
    
    this.trigger('change:node', parent);
    this.selectNode(newNode.key);
  },

  // Remove a node from the document
  removeNode: function(nodeKey) {
    var node = this.g.get('nodes', nodeKey);
    node.parent.removeChild(node.key);
    
    this.trigger('change:node', node.parent);
  },
  
  getNode: function(nodeKey) {
    if (nodeKey === 'root') {
      return this.g;
    } else {
      return this.g.get('nodes', nodeKey);
    }
  },
  
  updateNode: function(nodeKey, attrs) {
    var node = this.getNode(nodeKey);
    
    _.extend(node.data, attrs);
    this.makeDirtyNode(nodeKey);
    
    // if (this.selectedNode === node) {
    //   this.trigger('select:node', this.selectedNode);
    // }
  },
  
  // Update attributes of selected node
  updateSelectedNode: function(attrs) {
    _.extend(this.selectedNode.data, attrs);
    
    // Only set dirty if explicitly
    if (attrs.dirty) {
      this.makeDirtyNode(this.selectedNode.key);
    }
    
    // Notify all collaborators about the changed node
    socket.send({
      type: "change:node",
      body: {
        key: this.selectedNode.key,
        node: this.selectedNode.serialize()
      }
    });
  },
  
  selectNode: function(nodeKey) {
    this.selectedNode = this.getNode(nodeKey);
    this.trigger('select:node', this.selectedNode);
  }
});

// Acts as a stub for new documents

Document.EMPTY = {
  "title": "Untitled",
  "author": "John Doe",
  "children": ["1", "2"],
  "nodeCount": 5,
  "nodes": {
    "1": {
      "type": "section",
      "name": "First Chapter",
      "children": ["3", "5"]
    },
    "2": {
      "type": "section",
      "name": "Second Chapter",
      "children": ["4"]
    },
    "3": {
      "type": "paragraph",
      "content": "Your text goes here."
    },
    "4": {
      "type": "image",
      "url": "http://tmp.vivian.transloadit.com/scratch/9a65045a69dd88c2baf281c28dbd15a7"
    },
    "5": {
      "type": "paragraph",
      "content": "Additional text."
    }
  }
};


// Todo Collection
// ---------------

// The collection of todos is backed by *localStorage* instead of a remote
// server.
var DocumentList = Backbone.Collection.extend({

  // Reference to this collection's model.
  model: Document,
  
  url: '/documents',
  
  initialize: function() {
    
  },

  // We keep the Documents in sequential order, despite being saved by unordered
  // GUID in the database. This generates the next order number for new items.
  nextOrder: function() {
    if (!this.length) return 1;
    return this.last().get('order') + 1;
  },

  // Todos are sorted by their original insertion order.
  comparator: function(todo) {
    return todo.get('order');
  }
});

var Documents = new DocumentList();