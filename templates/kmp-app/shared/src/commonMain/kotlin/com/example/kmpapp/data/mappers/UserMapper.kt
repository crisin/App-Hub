package com.example.kmpapp.data.mappers

import com.example.kmpapp.data.api.dto.UserDto
import com.example.kmpapp.domain.models.User

fun UserDto.toDomain(): User = User(
    id = id,
    name = name,
    email = email,
    avatarUrl = avatarUrl
)

fun User.toDto(): UserDto = UserDto(
    id = id,
    name = name,
    email = email,
    avatarUrl = avatarUrl
)
