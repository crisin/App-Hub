package com.example.kmpapp.domain.models

data class Location(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float = 0f,
    val altitude: Double? = null,
    val timestampMs: Long = 0L
)
