# ==============================================================================
# CareTag Learning Engine -- Step 2: LSTM Routine Model (PyTorch)
# ==============================================================================
# Builds and trains an LSTM neural network using PyTorch that learns
# the temporal sequence of location clusters. The model takes a window of past
# (time_slot, cluster_id) pairs and predicts the *next expected cluster*.
#
# Architecture:
#   +----------------+    +------------------+
#   | Cluster IDs    |    |   Time Slots     |
#   |  (seq_len,)    |    |   (seq_len,)     |
#   +-------+--------+    +--------+---------+
#           |                      |
#   +-------v--------+    +-------v----------+
#   |  Embedding     |    |  Linear (time)   |
#   |  (emb_dim)     |    |  (dense_units)   |
#   +-------+--------+    +--------+---------+
#           |                      |
#           +------+-------+------+
#                  |  Concatenate
#           +------v-------+
#           |   LSTM(128)  |
#           +------+-------+
#                  |
#           +------v-------+
#           |  Dropout(0.3)|
#           +------+-------+
#                  |
#           +------v-------+
#           | Linear(softmax)| -> predicted cluster probabilities
#           +--------------+
# ==============================================================================

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import os
import sys
import io

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

# Fix Windows console encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader


class RoutineLSTM(nn.Module):
    """
    Dual-input LSTM model for routine sequence prediction.

    Two input branches:
      1. Cluster IDs  -> Embedding layer (learns dense representations of locations)
      2. Time Slots   -> Linear layer (learns temporal patterns)

    These are concatenated and fed into an LSTM that predicts the next cluster.
    """

    def __init__(
        self,
        num_clusters: int,
        num_time_slots: int = None,
        embedding_dim: int = None,
        dense_time_units: int = None,
        lstm_units: int = None
    ):
        super(RoutineLSTM, self).__init__()

        if num_time_slots is None:
            num_time_slots = config.NUM_TIME_SLOTS
        if embedding_dim is None:
            embedding_dim = config.EMBEDDING_DIM
        if dense_time_units is None:
            dense_time_units = config.DENSE_TIME_UNITS
        if lstm_units is None:
            lstm_units = config.LSTM_UNITS

        self.num_clusters = num_clusters
        self.num_time_slots = num_time_slots
        self.embedding_dim = embedding_dim
        self.dense_time_units = dense_time_units
        self.lstm_units = lstm_units

        # ---- Branch 1: Cluster Embedding ----
        self.cluster_embedding = nn.Embedding(
            num_embeddings=num_clusters,
            embedding_dim=embedding_dim
        )

        # ---- Branch 2: Time Slot Dense ----
        self.time_dense = nn.Linear(1, dense_time_units)
        self.time_relu = nn.ReLU()

        # ---- LSTM Backbone ----
        self.lstm = nn.LSTM(
            input_size=embedding_dim + dense_time_units,
            hidden_size=lstm_units,
            batch_first=True
        )

        # ---- Output Head ----
        self.dropout = nn.Dropout(0.3)
        self.output_layer = nn.Linear(lstm_units, num_clusters)

    def forward(self, cluster_input, time_input):
        """
        Forward pass.

        Args:
            cluster_input: (batch, seq_len) LongTensor of cluster IDs
            time_input:    (batch, seq_len) LongTensor of time-slot indices

        Returns:
            (batch, num_clusters) logits for the next cluster prediction
        """
        # Branch 1: Embed cluster IDs -> (batch, seq_len, emb_dim)
        cluster_emb = self.cluster_embedding(cluster_input)

        # Branch 2: Normalize time and pass through dense
        # (batch, seq_len) -> (batch, seq_len, 1) -> (batch, seq_len, dense_units)
        time_normalized = time_input.float() / float(self.num_time_slots)
        time_features = time_normalized.unsqueeze(-1)  # (batch, seq_len, 1)
        time_features = self.time_relu(self.time_dense(time_features))

        # Merge: (batch, seq_len, emb_dim + dense_units)
        merged = torch.cat([cluster_emb, time_features], dim=-1)

        # LSTM: take only the last hidden state
        lstm_out, _ = self.lstm(merged)
        last_hidden = lstm_out[:, -1, :]  # (batch, lstm_units)

        # Output
        dropped = self.dropout(last_hidden)
        logits = self.output_layer(dropped)  # (batch, num_clusters)

        return logits

    def predict_proba(self, cluster_input, time_input):
        """
        Get softmax probabilities (for inference / anomaly scoring).

        Args:
            cluster_input: (batch, seq_len) LongTensor
            time_input:    (batch, seq_len) LongTensor

        Returns:
            (batch, num_clusters) probability tensor
        """
        self.eval()
        with torch.no_grad():
            logits = self.forward(cluster_input, time_input)
            probs = torch.softmax(logits, dim=-1)
        return probs


def plot_training_history(history: dict, save_dir: str = None):
    """
    Plot and save the training loss and accuracy curves.

    Args:
        history: Dict with keys: train_loss, val_loss, train_acc, val_acc (lists)
        save_dir: Directory to save the plot.
    """
    if save_dir is None:
        save_dir = config.PLOTS_DIR

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("CareTag -- LSTM Training History", fontsize=16, fontweight="bold")

    epochs = range(1, len(history["train_loss"]) + 1)

    # Loss
    ax1.plot(epochs, history["train_loss"], "b-", linewidth=2, label="Train Loss")
    if history.get("val_loss"):
        ax1.plot(epochs, history["val_loss"], "r--", linewidth=2, label="Val Loss")
    ax1.set_xlabel("Epoch", fontsize=12)
    ax1.set_ylabel("Loss (CrossEntropy)", fontsize=12)
    ax1.set_title("Loss Curve", fontsize=14)
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # Accuracy
    ax2.plot(epochs, history["train_acc"], "b-", linewidth=2, label="Train Acc")
    if history.get("val_acc"):
        ax2.plot(epochs, history["val_acc"], "r--", linewidth=2, label="Val Acc")
    ax2.set_xlabel("Epoch", fontsize=12)
    ax2.set_ylabel("Accuracy", fontsize=12)
    ax2.set_title("Accuracy Curve", fontsize=14)
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plot_path = os.path.join(save_dir, "lstm_training_history.png")
    plt.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Training plot saved -> {plot_path}")


def train_lstm_model(
    X_slots: np.ndarray,
    X_clusters: np.ndarray,
    y_onehot: np.ndarray,
    num_clusters: int
) -> RoutineLSTM:
    """
    Full training pipeline: build model -> train -> save -> plot.

    Args:
        X_slots:      (N, seq_len) array of time-slot indices.
        X_clusters:   (N, seq_len) array of cluster IDs.
        y_onehot:     (N, num_clusters) one-hot encoded targets.
        num_clusters: Number of location clusters.

    Returns:
        Trained PyTorch RoutineLSTM model.
    """
    print("=" * 60)
    print("  CareTag -- Step 2b: LSTM Routine Model Training (PyTorch)")
    print("=" * 60)
    print(f"  Training samples  : {len(X_slots):,}")
    print(f"  Sequence length   : {config.SEQUENCE_LENGTH}")
    print(f"  Num clusters      : {num_clusters}")
    print(f"  LSTM units        : {config.LSTM_UNITS}")
    print(f"  Embedding dim     : {config.EMBEDDING_DIM}")
    print(f"  Batch size        : {config.BATCH_SIZE}")
    print(f"  Max epochs        : {config.EPOCHS}")
    print("-" * 60)

    # ---- Device ----
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"  Device: {device}")

    # ---- Build model ----
    model = RoutineLSTM(num_clusters).to(device)
    print(f"\n  Model Architecture:")
    print(f"  {model}\n")

    # ---- Prepare data ----
    # Convert one-hot targets to class indices
    y_labels = np.argmax(y_onehot, axis=1)

    # Train/val split
    n = len(X_slots)
    split_idx = int(n * (1 - config.VALIDATION_SPLIT))

    X_slots_train = torch.LongTensor(X_slots[:split_idx]).to(device)
    X_clusters_train = torch.LongTensor(X_clusters[:split_idx]).to(device)
    y_train = torch.LongTensor(y_labels[:split_idx]).to(device)

    X_slots_val = torch.LongTensor(X_slots[split_idx:]).to(device)
    X_clusters_val = torch.LongTensor(X_clusters[split_idx:]).to(device)
    y_val = torch.LongTensor(y_labels[split_idx:]).to(device)

    train_dataset = TensorDataset(X_clusters_train, X_slots_train, y_train)
    train_loader = DataLoader(train_dataset, batch_size=config.BATCH_SIZE, shuffle=True)

    val_dataset = TensorDataset(X_clusters_val, X_slots_val, y_val)
    val_loader = DataLoader(val_dataset, batch_size=config.BATCH_SIZE, shuffle=False)

    # ---- Loss and optimizer ----
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=config.LEARNING_RATE)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=3, min_lr=1e-6
    )

    # ---- Training loop ----
    history = {"train_loss": [], "val_loss": [], "train_acc": [], "val_acc": []}
    best_val_loss = float("inf")
    patience_counter = 0

    print("  Starting training...")
    for epoch in range(1, config.EPOCHS + 1):
        # -- Train --
        model.train()
        total_loss = 0
        correct = 0
        total = 0

        for batch_clusters, batch_slots, batch_y in train_loader:
            optimizer.zero_grad()
            logits = model(batch_clusters, batch_slots)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * batch_y.size(0)
            preds = logits.argmax(dim=1)
            correct += (preds == batch_y).sum().item()
            total += batch_y.size(0)

        train_loss = total_loss / total
        train_acc = correct / total

        # -- Validate --
        model.eval()
        val_total_loss = 0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for batch_clusters, batch_slots, batch_y in val_loader:
                logits = model(batch_clusters, batch_slots)
                loss = criterion(logits, batch_y)

                val_total_loss += loss.item() * batch_y.size(0)
                preds = logits.argmax(dim=1)
                val_correct += (preds == batch_y).sum().item()
                val_total += batch_y.size(0)

        val_loss = val_total_loss / max(val_total, 1)
        val_acc = val_correct / max(val_total, 1)

        # Record history
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["train_acc"].append(train_acc)
        history["val_acc"].append(val_acc)

        # Learning rate scheduling
        scheduler.step(val_loss)

        # Print progress
        print(f"  Epoch {epoch:3d}/{config.EPOCHS} | "
              f"Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss:.4f} Acc: {val_acc:.4f}")

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            # Save best model
            torch.save({
                "model_state_dict": model.state_dict(),
                "num_clusters": num_clusters,
                "config": {
                    "sequence_length": config.SEQUENCE_LENGTH,
                    "num_time_slots": config.NUM_TIME_SLOTS,
                    "embedding_dim": config.EMBEDDING_DIM,
                    "dense_time_units": config.DENSE_TIME_UNITS,
                    "lstm_units": config.LSTM_UNITS,
                }
            }, config.LSTM_MODEL_PATH)
        else:
            patience_counter += 1
            if patience_counter >= config.EARLY_STOPPING_PATIENCE:
                print(f"\n  Early stopping at epoch {epoch} "
                      f"(no improvement for {config.EARLY_STOPPING_PATIENCE} epochs)")
                break

    # ---- Load best model ----
    checkpoint = torch.load(config.LSTM_MODEL_PATH, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    print(f"\n  Model saved -> {config.LSTM_MODEL_PATH}")

    # ---- Plot training curves ----
    plot_training_history(history)

    # ---- Final metrics ----
    print(f"\n  Final Train Accuracy : {history['train_acc'][-1]:.4f}")
    print(f"  Final Val Accuracy   : {history['val_acc'][-1]:.4f}")
    print(f"  Best Val Loss        : {best_val_loss:.4f}")
    print("=" * 60)

    return model


# ==============================================================================
# Quick standalone test
# ==============================================================================
if __name__ == "__main__":
    # Load pre-saved training sequences
    data = np.load(config.TRAINING_SEQUENCES_PATH)
    X_slots = data["X_slots"]
    X_clusters = data["X_clusters"]
    y_onehot = data["y_onehot"]

    num_clusters = y_onehot.shape[1]
    model = train_lstm_model(X_slots, X_clusters, y_onehot, num_clusters)
